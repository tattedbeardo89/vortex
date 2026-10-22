// Copyright (C) 2026 Vortex contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Original Vortex extension. Nonblocking, bounded, render-thread-only HTTP transport.
#pragma once
#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <fcntl.h>
#include <unistd.h>
#include <algorithm>
#include <array>
#include <cerrno>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <map>
#include <string>
#include <vector>

namespace vortex_web {
using Clock = std::chrono::steady_clock;
constexpr std::size_t kHeader = 8192, kBody = 16384, kResponse = 2*1024*1024;
inline bool private_address(const std::string& text) {
  in_addr address{};
  if (inet_pton(AF_INET,text.c_str(),&address)!=1) return false;
  const auto ip=ntohl(address.s_addr);
  return (ip>>24)==10 || (ip>>24)==127 || (ip>>16)==0xc0a8 || (ip>>20)==0xac1 || (ip>>16)==0xa9fe;
}
inline bool secure_random(std::size_t count,std::string& hex) {
  if(count<4 || count>64)return false;
  std::array<unsigned char,64> bytes{};
  for(const char* path : {"/dev/urandom","/dev/random"}) {
    int fd=open(path,O_RDONLY|O_NONBLOCK);
    if(fd<0)continue;
    std::size_t used=0;
    while(used<count) {
      const auto got=read(fd,bytes.data()+used,count-used);
      if(got>0)used+=static_cast<std::size_t>(got);
      else if(got<0 && errno==EINTR)continue;
      else break;
    }
    close(fd);
    if(used!=count)continue;
    hex.clear();
    for(std::size_t i=0;i<count;++i) {hex+="0123456789abcdef"[bytes[i]>>4];hex+="0123456789abcdef"[bytes[i]&15];}
    return true;
  }
  return false;
}
struct Request {
  unsigned id=0;
  std::string method,target,peer,local,body;
  std::map<std::string,std::string> headers;
};
struct Client {
  int fd=-1;
  unsigned id=0;
  bool dispatched=false;
  std::size_t sent=0;
  std::string input,output,peer,local;
  Clock::time_point deadline;
};
class Server {
  int listener_=-1;
  unsigned next_=1;
  std::uint16_t port_=0;
  std::array<Client,16> clients_{};
  void drop(Client& client) {if(client.fd>=0)close(client.fd);client=Client{};}
  static bool nonblocking(int fd) {
    const int flags=fcntl(fd,F_GETFL,0);
    return flags>=0 && fcntl(fd,F_SETFL,flags|O_NONBLOCK)>=0 && fcntl(fd,F_SETFD,FD_CLOEXEC)>=0;
  }
  static std::string address(const sockaddr_in& value) {
    char text[INET_ADDRSTRLEN]{};
    inet_ntop(AF_INET,&value.sin_addr,text,sizeof text);
    return text;
  }
  // -1 malformed, 0 incomplete, 1 complete. Duplicates and request smuggling are refused.
  static int parse(const Client& client,Request& out) {
    const auto end=client.input.find("\r\n\r\n");
    if(end==std::string::npos)return client.input.size()>kHeader ? -1:0;
    if(end>kHeader)return -1;
    const auto first=client.input.find("\r\n");
    const auto line=client.input.substr(0,first);
    const auto space=line.find(' '),last=line.find(' ',space==std::string::npos?0:space+1);
    if(space==std::string::npos || last==std::string::npos || line.find(' ',last+1)!=std::string::npos)return -1;
    out.method=line.substr(0,space);out.target=line.substr(space+1,last-space-1);
    if((line.substr(last+1)!="HTTP/1.1" && line.substr(last+1)!="HTTP/1.0") || out.target.empty() || out.target[0]!='/' || out.target.size()>4096)return -1;
    if(out.method!="GET" && out.method!="POST" && out.method!="PATCH" && out.method!="DELETE")return -1;
    for(unsigned char c:out.target)if(c<=32 || c>=127)return -1;
    std::size_t pos=first+2;
    while(pos<end) {
      const auto stop=client.input.find("\r\n",pos);
      const auto field=client.input.substr(pos,stop-pos);
      const auto colon=field.find(':');
      if(colon==std::string::npos || colon==0)return -1;
      std::string name=field.substr(0,colon),value=field.substr(colon+1);
      for(char& c:name) {if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||c=='-'))return -1;if(c>='A'&&c<='Z')c+=32;}
      while(!value.empty() && (value.front()==' ' || value.front()=='\t'))value.erase(0,1);
      while(!value.empty() && (value.back()==' ' || value.back()=='\t'))value.pop_back();
      for(unsigned char c:value)if(c<32 || c==127)return -1;
      if(out.headers.count(name))return -1;
      out.headers[name]=value;pos=stop+2;
    }
    if(!out.headers.count("host") || out.headers.count("transfer-encoding") || out.headers.count("expect"))return -1;
    std::size_t length=0;
    if(out.headers.count("content-length")) {
      const auto& value=out.headers.at("content-length");if(value.empty())return -1;
      for(char c:value) {if(c<'0'||c>'9')return -1;length=length*10+static_cast<unsigned>(c-'0');if(length>kBody)return -1;}
    }
    if(client.input.size()<end+4+length)return 0;
    if(client.input.size()!=end+4+length)return -1; // no HTTP pipelining / ambiguous trailing bytes
    out.body=client.input.substr(end+4,length);out.id=client.id;out.peer=client.peer;out.local=client.local;
    return 1;
  }
public:
  ~Server() {stop();}
  void stop() {for(auto& client:clients_)drop(client);if(listener_>=0)close(listener_);listener_=-1;port_=0;}
  std::uint16_t port() const {return port_;}
  bool start(const std::string& bind_address,int port,std::string& error) {
    if((bind_address!="0.0.0.0" && !private_address(bind_address)) || port<1024 || port>65535) {error="Use a private IPv4 binding and port 1024..65535";return false;}
    std::string entropy;
    if(!secure_random(32,entropy)) {error="OS cryptographic randomness unavailable; Vortex Web remains disabled";return false;}
    stop();
    int fd=socket(AF_INET,SOCK_STREAM,0);
    if(fd<0) {error="Cannot create Vortex Web listener";return false;}
    int on=1;
    setsockopt(fd,SOL_SOCKET,SO_REUSEADDR,&on,sizeof on);
#ifdef SO_NOSIGPIPE
    setsockopt(fd,SOL_SOCKET,SO_NOSIGPIPE,&on,sizeof on);
#endif
    sockaddr_in addr{};addr.sin_family=AF_INET;addr.sin_port=htons(static_cast<std::uint16_t>(port));
#ifdef PROSPERO
    addr.sin_len=sizeof addr;
#endif
    inet_pton(AF_INET,bind_address.c_str(),&addr.sin_addr);
    if(!nonblocking(fd) || bind(fd,reinterpret_cast<const sockaddr*>(&addr),sizeof addr)<0 || listen(fd,16)<0) {
      close(fd);error="Cannot bind Vortex Web port (in use or unavailable); choose another port";return false;
    }
    listener_=fd;port_=static_cast<std::uint16_t>(port);return true;
  }
  void reply(unsigned id,int status,const std::string& type,const std::string& body,const std::string& extra="") {
    if(body.size()>kResponse || type.find_first_of("\r\n")!=std::string::npos)return;
    for(auto& c:clients_)if(c.fd>=0 && c.id==id && c.output.empty()) {
      c.output="HTTP/1.1 "+std::to_string(status)+" Vortex\r\nContent-Type: "+type+"\r\nContent-Length: "+std::to_string(body.size())+
        "\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\n"+
        "Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'\r\n"+
        extra+"\r\n"+body;
      c.deadline=Clock::now()+std::chrono::seconds(20);return;
    }
  }
  std::vector<Request> poll() {
    std::vector<Request> out;
    if(listener_<0)return out;
    const auto budget=Clock::now()+std::chrono::milliseconds(2);
    for(unsigned i=0;i<4;++i) {
      sockaddr_in peer{};socklen_t size=sizeof peer;
      int fd=accept(listener_,reinterpret_cast<sockaddr*>(&peer),&size);
      if(fd<0)break;
      auto slot=std::find_if(clients_.begin(),clients_.end(),[](const Client& c){return c.fd<0;});
      if(slot==clients_.end() || !private_address(address(peer)) || !nonblocking(fd)) {close(fd);continue;}
#ifdef SO_NOSIGPIPE
      int on=1;setsockopt(fd,SOL_SOCKET,SO_NOSIGPIPE,&on,sizeof on);
#endif
      sockaddr_in local{};size=sizeof local;
      if(getsockname(fd,reinterpret_cast<sockaddr*>(&local),&size)<0) {close(fd);continue;}
      slot->fd=fd;slot->id=next_++;slot->peer=address(peer);slot->local=address(local);slot->deadline=Clock::now()+std::chrono::seconds(10);
    }
    for(auto& c:clients_) {
      if(c.fd<0)continue;
      if(Clock::now()>c.deadline) {drop(c);continue;}
      if(!c.output.empty()) {
#ifdef MSG_NOSIGNAL
        const int flags=MSG_NOSIGNAL;
#else
        const int flags=0;
#endif
        auto count=send(c.fd,c.output.data()+c.sent,std::min<std::size_t>(16384,c.output.size()-c.sent),flags);
        if(count>0)c.sent+=static_cast<std::size_t>(count);
        else if(count<0 && errno!=EAGAIN && errno!=EWOULDBLOCK && errno!=EINTR) {drop(c);continue;}
        if(c.sent==c.output.size())drop(c);
      } else if(!c.dispatched && out.size()<4) {
        char buffer[4096];auto count=recv(c.fd,buffer,sizeof buffer,0);
        if(count>0) {
          c.input.append(buffer,static_cast<std::size_t>(count));Request request;
          int result=parse(c,request);
          if(result<0) {c.dispatched=true;reply(c.id,400,"text/plain","Invalid HTTP request");}
          else if(result>0) {c.dispatched=true;out.push_back(std::move(request));}
        } else if(count==0 || (errno!=EAGAIN && errno!=EWOULDBLOCK && errno!=EINTR)) {drop(c);}
      }
      if(Clock::now()>budget)break;
    }
    return out;
  }
};

#ifndef VORTEX_WEB_TRANSPORT_ONLY
inline Server server;
inline std::string string_arg(JSContext* ctx,JSValueConst value) {
  std::size_t size=0;const char* data=JS_ToCStringLen(ctx,&size,value);
  if(!data)return {};std::string out(data,size);JS_FreeCString(ctx,data);return out;
}
inline JSValue start(JSContext* ctx,JSValueConst,int argc,JSValueConst* argv) {
  int port=0;if(argc!=2 || JS_ToInt32(ctx,&port,argv[1])<0)return JS_ThrowTypeError(ctx,"Vortex Web start needs binding and port");
  std::string error;
  if(!server.start(string_arg(ctx,argv[0]),port,error))return JS_ThrowInternalError(ctx,"%s",error.c_str());
  return JS_NewInt32(ctx,server.port());
}
inline JSValue stop(JSContext*,JSValueConst,int,JSValueConst*) {server.stop();return JS_UNDEFINED;}
inline JSValue random(JSContext* ctx,JSValueConst,int argc,JSValueConst* argv) {
  int count=0;std::string text;
  if(argc!=1 || JS_ToInt32(ctx,&count,argv[0])<0 || count<4 || count>64 || !secure_random(static_cast<std::size_t>(count),text))return JS_ThrowInternalError(ctx,"OS secure randomness unavailable");
  return JS_NewStringLen(ctx,text.data(),text.size());
}
inline JSValue poll(JSContext* ctx,JSValueConst,int,JSValueConst*) {
  JSValue list=JS_NewArray(ctx);unsigned index=0;
  for(const auto& request:server.poll()) {
    JSValue row=JS_NewObject(ctx),headers=JS_NewObject(ctx);
    for(const auto& [key,value]:request.headers)JS_SetPropertyStr(ctx,headers,key.c_str(),JS_NewStringLen(ctx,value.data(),value.size()));
    JS_SetPropertyStr(ctx,row,"id",JS_NewUint32(ctx,request.id));
    for(const auto& [key,value]:std::vector<std::pair<std::string,std::string>>{{"method",request.method},{"target",request.target},{"peer",request.peer},{"local",request.local},{"body",request.body}})
      JS_SetPropertyStr(ctx,row,key.c_str(),JS_NewStringLen(ctx,value.data(),value.size()));
    JS_SetPropertyStr(ctx,row,"headers",headers);JS_SetPropertyUint32(ctx,list,index++,row);
  }
  return list;
}
inline JSValue reply(JSContext* ctx,JSValueConst,int argc,JSValueConst* argv) {
  unsigned id=0;int status=0;
  if(argc!=5 || JS_ToUint32(ctx,&id,argv[0])<0 || JS_ToInt32(ctx,&status,argv[1])<0 || status<200 || status>599)return JS_ThrowTypeError(ctx,"Invalid Vortex response");
  // Only the trusted JS router supplies the optional Set-Cookie header; HTTP never controls it directly.
  auto cookie=string_arg(ctx,argv[4]);
  if(cookie.find_first_of("\r\n")!=std::string::npos)return JS_ThrowTypeError(ctx,"Invalid response cookie");
  server.reply(id,status,string_arg(ctx,argv[2]),string_arg(ctx,argv[3]),cookie.empty()?"":"Set-Cookie: "+cookie+"\r\n");return JS_UNDEFINED;
}
inline void install(JSContext* ctx,JSValue global) {
  JSValue api=JS_NewObject(ctx);JS_SetPropertyStr(ctx,api,"abi",JS_NewInt32(ctx,1));
  for(const auto& fn:std::vector<std::pair<const char*,JSCFunction*>>{{"start",start},{"stop",stop},{"random",random},{"poll",poll},{"reply",reply}})
    JS_SetPropertyStr(ctx,api,fn.first,JS_NewCFunction(ctx,fn.second,fn.first,5));
  JS_SetPropertyStr(ctx,global,"__vortexWebNative",api);
}
#endif
} // namespace vortex_web

// Standalone test harness for the same transport compiled into both native hosts.
#define VORTEX_WEB_TRANSPORT_ONLY
#include "../backend/server.hpp"
#include <iostream>
#include <thread>
#include <cstdlib>
int main(int argc,char** argv) {
  if(argc!=2)return 2;
  vortex_web::Server server;std::string error,first,second;
  if(!vortex_web::secure_random(32,first)||!vortex_web::secure_random(32,second)||first==second)return 3;
  if(!server.start("127.0.0.1",std::atoi(argv[1]),error)){std::cerr<<error<<'\n';return 4;}
  std::cout<<"ready\n"<<std::flush;
  for(;;){for(const auto& request:server.poll())server.reply(request.id,200,"text/plain",request.method+" "+request.target+" "+request.body);std::this_thread::sleep_for(std::chrono::milliseconds(2));}
}

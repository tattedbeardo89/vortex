import concurrent.futures
import http.client
from pathlib import Path
import socket
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[4]
class NativeTransport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        binary=ROOT/'.vortex/web-native-test';binary.parent.mkdir(exist_ok=True)
        subprocess.run(['clang++','-std=c++20','-Wall','-Wextra','-Werror',str(Path(__file__).with_name('native_server.cpp')),'-o',str(binary)],check=True)
        with socket.socket() as probe:probe.bind(('127.0.0.1',0));cls.port=probe.getsockname()[1]
        cls.process=subprocess.Popen([str(binary),str(cls.port)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        if cls.process.stdout.readline().strip()!='ready':raise RuntimeError('Native listener failed to start')
    @classmethod
    def tearDownClass(cls):
        cls.process.terminate();cls.process.wait(timeout=5)
    def request(self,target):
        connection=http.client.HTTPConnection('127.0.0.1',self.port,timeout=5)
        connection.request('GET',target);response=connection.getresponse();body=response.read().decode();connection.close();return response.status,body
    def test_real_tcp_requests_and_concurrent_clients(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(self.request,[f'/client-{i}' for i in range(8)]))
        self.assertEqual(results,[(200,f'GET /client-{i} ') for i in range(8)])
    def malformed(self,text):
        with socket.create_connection(('127.0.0.1',self.port),timeout=5) as client:
            client.sendall(text.encode());return client.recv(4096).decode()
    def test_duplicate_headers_smuggling_and_oversize_refused(self):
        for text in [
            'GET / HTTP/1.1\r\nHost: localhost\r\nHost: evil\r\n\r\n',
            'POST / HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n',
            'POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 99999999\r\n\r\n',
            'GET / HTTP/1.1\r\nHost: localhost\r\nBad Header: yes\r\n\r\n',
        ]:
            with self.subTest(request=text.splitlines()[0]):self.assertIn('400 Vortex',self.malformed(text))
    def test_body_delivered_without_interpreting_as_commands(self):
        c=http.client.HTTPConnection('127.0.0.1',self.port,timeout=5);c.request('POST','/api/v1/test','{"safe":true}',{'Content-Type':'application/json'});r=c.getresponse();self.assertEqual(r.status,200);self.assertEqual(r.read(),b'POST /api/v1/test {"safe":true}');c.close()
    def test_disconnect_does_not_stop_listener(self):
        with socket.create_connection(('127.0.0.1',self.port)) as c:c.sendall(b'GET /incomplete')
        self.assertEqual(self.request('/after-disconnect')[0],200)

if __name__=='__main__':unittest.main()

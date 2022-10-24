import gzip
import logging
import zlib
import ipaddress
from tqdm import tqdm
from glob import glob

logging.basicConfig(level=logging.INFO)


def calc_crc(ip_addr):
    result = []
    for proto in ('tcp', 'udp'):
        for _type in ('local',):
            in_str = f"{_type}{ip_addr}{proto}"
            result.append((zlib.crc32(in_str.encode('ascii')), (str(ip_addr), proto, _type)))
    return result


chunks = {}
for n in range(1000):
    chunks[n] = open(f'db/{n}.json', 'wb')


def chunk_write(_crc, content):
    chunks[int(str(_crc)[-3:])].write(content.encode('ascii'))


with open('lookup.json', 'w') as f:
    logging.info('192.168.0.0/16')
    for ip in tqdm(ipaddress.IPv4Network('192.168.0.0/16')):
        for crc, attrs in calc_crc(ip):
            chunk_write(crc, f"{crc}={':'.join(attrs)}\n")

    logging.info('10.0.0.0/8')
    for ip in tqdm(ipaddress.IPv4Network('10.0.0.0/8')):
        for crc, attrs in calc_crc(ip):
            chunk_write(crc, f"{crc}={':'.join(attrs)}\n")

    logging.info('172.16.0.0/12')
    for ip in tqdm(ipaddress.IPv4Network('172.16.0.0/12')):
        for crc, attrs in calc_crc(ip):
            chunk_write(crc, f"{crc}={':'.join(attrs)}\n")

    logging.info('Custom WSL net addrs')
    # Extra: WSL network typically sets host at `172.xx.yy.1`
    for n in range(1, 255):
        if n == 16:
            # covered in prev
            continue
        for m in range(1, 255):
            ip = ipaddress.IPv4Address(f"172.{n}.{m}.1")
            for crc, attrs in calc_crc(ip):
                chunk_write(crc, f"{crc}={':'.join(attrs)}\n")

for chf in chunks.values():
    chf.close()

for fn in glob('db/*.json'):
    with open(fn, 'rb') as src:
        with gzip.open(fn + '.gz', 'wb') as dest:
            dest.write(src.read())

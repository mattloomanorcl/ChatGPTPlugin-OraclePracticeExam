"""Build a self-contained macOS .command and ZIP on Windows or macOS."""
from pathlib import Path
import argparse, hashlib, io, json, struct, tarfile, zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True)
parser.add_argument('--downloads',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
source=Path(args.source).resolve(); downloads=Path(args.downloads).resolve(); output=Path(args.output).resolve()
builder=Path(__file__).resolve().parent
output.mkdir(parents=True,exist_ok=True)
checks={line.split()[1]:line.split()[0] for line in (downloads/'SHASUMS256.txt').read_text().splitlines() if len(line.split())==2}
version=json.loads((source/'plugin.json').read_text())['version']
payload=downloads/'mac-payload.tar.gz'

def add_bytes(archive,name,data,mode=0o644):
    entry=tarfile.TarInfo(name);entry.size=len(data);entry.mode=mode;entry.mtime=0
    archive.addfile(entry,io.BytesIO(data))

with tarfile.open(payload,'w:gz',compresslevel=9,format=tarfile.USTAR_FORMAT) as bundle:
    files=[p for p in source.iterdir() if p.is_file()]
    for folder in ['src','public','skills','test','node_modules','.codex-plugin']:
        files += [p for p in (source/folder).rglob('*') if p.is_file()]
    for file in sorted(files):
        name=file.relative_to(source).as_posix()
        if file.is_symlink() or name=='.env' or '.sqlite' in name or file.suffix=='.node':
            raise RuntimeError(f'Nonportable or sensitive payload entry: {name}')
        add_bytes(bundle,'plugin/'+name,file.read_bytes())
    for arch,cpu in [('arm64',0x0100000c),('x64',0x01000007)]:
        filename=f'node-v24.15.0-darwin-{arch}.tar.gz'
        path=downloads/filename
        actual=hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
        if actual!=checks[filename]:raise RuntimeError(f'Official checksum mismatch: {filename}')
        with tarfile.open(path,'r:gz') as release:
            data=release.extractfile(f'node-v24.15.0-darwin-{arch}/bin/node').read()
            if data[:4]!=b'\xcf\xfa\xed\xfe' or struct.unpack('<I',data[4:8])[0]!=cpu:
                raise RuntimeError(f'Unexpected Mach-O architecture: {arch}')
            add_bytes(bundle,f'plugin/runtime/darwin-{arch}/node',data,0o755)
            if arch=='arm64':add_bytes(bundle,'plugin/runtime/NODE-LICENSE.txt',release.extractfile(f'node-v24.15.0-darwin-{arch}/LICENSE').read())
        print(f'Verified official runtime checksum and Mach-O header: {arch}')
    add_bytes(bundle,'install.mjs',(builder/'install.mjs').read_bytes())

with payload.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
header=(builder/'launcher.sh').read_text(encoding='utf-8').replace('PAYLOAD_HASH',digest).replace('\r\n','\n').encode('utf-8')
installer=output/'Oracle-Exam-Practice-Setup.command'
with installer.open('wb') as result:
    result.write(header)
    with payload.open('rb') as content:
        for chunk in iter(lambda:content.read(1024*1024),b''):result.write(chunk)

readme=output/'README-Mac.md'
archive=output/'Oracle-Exam-Practice-Mac-Installer.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_STORED) as zipped:
    for path,label,mode in [(installer,installer.name,0o100755),(readme,'README.md',0o100644)]:
        info=zipfile.ZipInfo('Oracle-Exam-Practice-Mac/'+label)
        info.create_system=3;info.external_attr=mode<<16
        zipped.writestr(info,path.read_bytes())
for path in [installer,archive]:
    with path.open('rb') as stream:sha=hashlib.file_digest(stream,'sha256').hexdigest()
    path.with_name(path.name+'.sha256').write_text(sha+'  '+path.name+'\n',encoding='ascii')
    print(f'{path.name}: {path.stat().st_size:,} bytes')
print('Built plug-in version '+version)

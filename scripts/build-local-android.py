"""Build an ARM64 test APK using a private, persistent local signing key.

The SDK and JDK must be installed first. Signing files stay in .local-build/,
which is excluded from Git. Back up that directory's signing files privately.
"""
from pathlib import Path
import json, os, secrets, subprocess
root = Path(__file__).resolve().parents[1]
os.chdir(root)
local = root / '.local-build'
local.mkdir(exist_ok=True)
env = os.environ.copy()
env['JAVA_HOME'] = subprocess.check_output(['mise','where','java@temurin-17'],text=True).strip()
env['ANDROID_HOME'] = str(local/'sdk')
env['ANDROID_SDK_ROOT'] = env['ANDROID_HOME']
env['PATH'] = env['JAVA_HOME']+'/bin:'+env['ANDROID_HOME']+'/platform-tools:'+env['PATH']
credentials = local/'signing.json'
if not credentials.exists():
    secret = secrets.token_urlsafe(32)
    credentials.write_text(json.dumps({'storePassword':secret,'keyPassword':secret,'alias':'pulse-local'}))
    credentials.chmod(0o600)
config = json.loads(credentials.read_text())
keystore = local/'pulse-release.jks'
env.update(PULSE_KEYSTORE_PATH=str(keystore),PULSE_STORE_PASSWORD=config['storePassword'],PULSE_KEY_PASSWORD=config['keyPassword'],PULSE_KEY_ALIAS=config['alias'])
if not keystore.exists():
    subprocess.run([env['JAVA_HOME']+'/bin/keytool','-genkeypair','-keystore',str(keystore),'-storepass:env','PULSE_STORE_PASSWORD','-keypass:env','PULSE_KEY_PASSWORD','-alias',config['alias'],'-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Pulse Gym Local Build','-noprompt'],env=env,check=True)
    keystore.chmod(0o600)
subprocess.run(['npx','expo','prebuild','--platform','android','--no-install'],env=env,check=True)
subprocess.run(['node','scripts/configure-signing.cjs'],env=env,check=True)
(root/'android/local.properties').write_text('sdk.dir='+str(local/'sdk')+'\n')
print('Building signed ARM64 APK. Credentials are not logged.',flush=True)
subprocess.run(['./gradlew','assembleRelease','--no-daemon','--max-workers=1','-PreactNativeArchitectures=arm64-v8a','-Pandroid.enableMinifyInReleaseBuilds=false','-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m'],cwd=root/'android',env=env,check=True)
output = root/'builds'
output.mkdir(exist_ok=True)
from shutil import copy2
copy2(root/'android/app/build/outputs/apk/release/app-release.apk',output/'pulse-gym-0.1.0-arm64.apk')
print('APK: '+str(output/'pulse-gym-0.1.0-arm64.apk'),flush=True)

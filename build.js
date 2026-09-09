const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🪁 Kite derleniyor (electron-builder & ASAR binary paketleme)...');

try {

  execSync('npx electron-builder', { stdio: 'inherit' });
  console.log('\n✅ Derleme işlemi başarıyla tamamlandı!');

  // Copy app.asar for instant in-place silent live updates (Chrome / Brave style)
  const unpackedAsar = path.join(__dirname, 'dist', 'win-unpacked', 'resources', 'app.asar');
  const targetAsar = path.join(__dirname, 'dist', 'app.asar');
  if (fs.existsSync(unpackedAsar)) {
    fs.copyFileSync(unpackedAsar, targetAsar);
    console.log('⚡ [Canlı Güncelleme] app.asar başarıyla dist/ klasörüne hazırlandı!');
  }
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    
    // Find installer files (ends with .exe)
    const installerFiles = files
      .filter(f => f.endsWith('.exe'))
      .map(f => {
        const filePath = path.join(distDir, f);
        return {
          name: f,
          path: filePath,
          time: fs.statSync(filePath).mtime.getTime()
        };
      });

    installerFiles.sort((a, b) => b.time - a.time);

    console.log(`\n📂 dist klasöründe derlenen yükleyici:`);
    installerFiles.forEach(f => console.log(`   📦 ${f.name}`));

    console.log('\n🚀 GİTHUB RELEASES SÜRÜMÜ YAYINLAMA REHBERİ:');
    console.log('1. GitHub tarayıcınızda şu adrese gidin:');
    console.log('   🔗 https://github.com/billythestudent/lowbrowser/releases/new');
    console.log('2. Versiyon etiketini yazın (Örn: v1.3.2)');
    console.log(`3. dist/ klasöründeki "Kite-Setup.exe" dosyasını sürükleyip bırakın.`);
    console.log('4. "Publish release" butonuna basın.');
    console.log('\n✨ Sitenizdeki indirme linki artık en son yayınladığınız bu sürümü otomatik dağıtacaktır!');
  }
} catch (error) {
  console.error('\n❌ Derleme sırasında hata oluştu:', error.message);
  process.exit(1);
}

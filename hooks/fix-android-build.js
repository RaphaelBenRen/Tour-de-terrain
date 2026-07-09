'use strict';

/**
 * Hook Cordova (after_prepare) — corrige deux incompatibilités du build Android
 * qui, sinon, font échouer `cordova build android` de façon reproductible :
 *
 *  1. WRITE_EXTERNAL_STORAGE en double : les plugins `cordova-plugin-camera`
 *     (maxSdkVersion 32) et `cordova-plugin-file` (maxSdkVersion 29) déclarent
 *     tous les deux cette permission dans le manifeste principal, avec des
 *     attributs différents -> le "manifest merger" échoue. On ne garde que la
 *     première déclaration.
 *
 *  2. Jetifier : inutile ici (tout est déjà AndroidX) et il corrompt les
 *     ressources d'appcompat 1.7.0 lors de la compilation -> on le désactive.
 *
 * Le hook est idempotent : on peut le relancer sans effet de bord.
 */
module.exports = function (context) {
  const fs = require('fs');
  const path = require('path');

  const projectRoot = context.opts.projectRoot;
  const androidDir = path.join(projectRoot, 'platforms', 'android');
  if (!fs.existsSync(androidDir)) {
    return; // plateforme android non installée : rien à faire
  }

  // 1) Dédoublonner WRITE_EXTERNAL_STORAGE dans le manifeste principal
  const manifestPath = path.join(
    androidDir,
    'app',
    'src',
    'main',
    'AndroidManifest.xml'
  );
  if (fs.existsSync(manifestPath)) {
    const lines = fs.readFileSync(manifestPath, 'utf8').split(/\r?\n/);
    let seenWrite = false;
    const kept = lines.filter((line) => {
      const isWrite =
        line.includes('uses-permission') &&
        line.includes('WRITE_EXTERNAL_STORAGE');
      if (isWrite) {
        if (seenWrite) return false; // doublon -> on supprime
        seenWrite = true;
      }
      return true;
    });
    if (kept.length !== lines.length) {
      fs.writeFileSync(manifestPath, kept.join('\n'), 'utf8');
      console.log(
        '[fix-android-build] WRITE_EXTERNAL_STORAGE dédoublonné dans AndroidManifest.xml'
      );
    }
  }

  // 2) Désactiver Jetifier
  const gradleProps = path.join(androidDir, 'gradle.properties');
  if (fs.existsSync(gradleProps)) {
    let content = fs.readFileSync(gradleProps, 'utf8');
    if (/android\.enableJetifier\s*=\s*true/.test(content)) {
      content = content.replace(
        /android\.enableJetifier\s*=\s*true/,
        'android.enableJetifier=false'
      );
      fs.writeFileSync(gradleProps, content, 'utf8');
      console.log('[fix-android-build] Jetifier désactivé (enableJetifier=false)');
    } else if (!/android\.enableJetifier/.test(content)) {
      content += '\nandroid.enableJetifier=false\n';
      fs.writeFileSync(gradleProps, content, 'utf8');
      console.log('[fix-android-build] Jetifier désactivé (ajout enableJetifier=false)');
    }
  }
};

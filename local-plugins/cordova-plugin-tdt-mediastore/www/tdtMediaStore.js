var exec = require('cordova/exec');

module.exports = {
  /**
   * Enregistre un fichier texte dans Téléchargements/TDT (visible en USB).
   * @param {string} fileName  ex. "TDT_export.csv"
   * @param {string} mimeType  ex. "text/csv"
   * @param {string} content   contenu texte du fichier
   */
  saveToDownloads: function (fileName, mimeType, content, success, error) {
    exec(success, error, 'TdtMediaStore', 'saveToDownloads', [fileName, mimeType, content]);
  }
};

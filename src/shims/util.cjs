module.exports = {
  inspect: function(arg) {
    try {
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    } catch(e) {
      return String(arg);
    }
  }
};
module.exports.default = module.exports;

(function () {
  try {
    var raw = localStorage.getItem('digitalinvoice-theme');
    var t = raw && raw.charAt(0) === '{' ? (JSON.parse(raw).state || {}).theme : raw;
    if (t !== 'light' && t !== 'dark') t = 'light'; // light by default; dark only when chosen
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
  } catch (e) {}
})();

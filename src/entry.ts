if (new URLSearchParams(location.search).has('screens')) {
  void import('./preview/Gallery');
} else {
  void import('./main');
}

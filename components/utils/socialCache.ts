let socialPromise: Promise<any[]> | null = null;

export function fetchSocialOnce(): Promise<any[]> {
  if (!socialPromise) {
    socialPromise = fetch('/api/social')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => (Array.isArray(d) ? d : []))
      .catch(err => {
        socialPromise = null; // fail hua to agli baar dobara try karo
        throw err;
      });
  }
  return socialPromise;
}
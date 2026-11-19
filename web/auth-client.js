(() => {
  let clientPromise;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch("/api/auth-config", {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const config = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(config.error || "Login belum dikonfigurasi.");
        }
        if (!window.supabase?.createClient) {
          throw new Error("Komponen login tidak dapat dimuat. Muat ulang halaman.");
        }

        return window.supabase.createClient(config.url, config.publishableKey, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true,
          },
        });
      })();
    }
    return clientPromise;
  }

  window.dashboardAuth = { getClient };
})();

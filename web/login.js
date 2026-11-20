let authClient;

const loginForm = document.querySelector("#loginForm");
const loginButton = document.querySelector("#loginButton");
const loginButtonText = document.querySelector("#loginButtonText");
const loginMessage = document.querySelector("#loginMessage");
const identifierInput = document.querySelector("#identifierInput");
const passwordInput = document.querySelector("#passwordInput");
const audioFallback = document.querySelector("#audioFallback");
const loginSuccessAudio = document.querySelector("#loginSuccessAudio");
const loginFailureAudio = document.querySelector("#loginFailureAudio");
const passwordSetupForm = document.querySelector("#passwordSetupForm");
const savePasswordButton = document.querySelector("#savePasswordButton");
const savePasswordButtonText = document.querySelector("#savePasswordButtonText");
const newPasswordInput = document.querySelector("#newPasswordInput");
const confirmPasswordInput = document.querySelector("#confirmPasswordInput");
const inviteType = new URLSearchParams(window.location.hash.slice(1)).get("type")
  || new URLSearchParams(window.location.search).get("type");

function showMessage(message, type = "error") {
  loginMessage.textContent = message;
  loginMessage.classList.remove("hidden", "login-message-error", "login-message-info");
  loginMessage.classList.add(type === "info" ? "login-message-info" : "login-message-error");
}

function setBusy(busy) {
  loginButton.disabled = busy;
  loginButton.classList.toggle("is-busy", busy);
  loginButton.querySelector(".login-spinner").classList.toggle("hidden", !busy);
  loginButton.querySelector("svg").classList.toggle("hidden", busy);
  loginButtonText.textContent = busy ? "Memeriksa akun…" : "Masuk";
}

function showPasswordSetup(session) {
  document.querySelector("#loginTitle").textContent = "Aktifkan akun";
  document.querySelector("#loginSubtitle").textContent = "Buat kata sandi pribadi sebelum membuka dashboard.";
  document.querySelector("#setupEmail").textContent = session.user.email || "Akun Anda";
  document.querySelector("#loginHelp").hidden = true;
  document.querySelector("#setupHelp").hidden = false;
  loginForm.hidden = true;
  passwordSetupForm.hidden = false;
  savePasswordButton.disabled = false;
  loginMessage.classList.add("hidden");
}

function setPasswordBusy(busy) {
  savePasswordButton.disabled = busy;
  savePasswordButton.classList.toggle("is-busy", busy);
  savePasswordButton.querySelector(".login-spinner").classList.toggle("hidden", !busy);
  savePasswordButtonText.textContent = busy ? "Menyimpan…" : "Simpan kata sandi";
}

function startAudio(audio) {
  audio.pause();
  audio.currentTime = 0;
  return audio.play().then(() => true).catch(() => false);
}

function waitForAudio(audio) {
  return new Promise((resolve) => {
    if (audio.ended) return resolve();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      audio.removeEventListener("ended", finish);
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, Math.min((audio.duration || 4) * 1000 + 500, 10000));
    audio.addEventListener("ended", finish, { once: true });
  });
}

async function playFailureAudio() {
  audioFallback.hidden = true;
  if (await startAudio(loginFailureAudio)) return;
  audioFallback.textContent = "Putar ulang audio";
  audioFallback.hidden = false;
  audioFallback.onclick = () => {
    audioFallback.hidden = true;
    startAudio(loginFailureAudio);
  };
}

async function playSuccessAudio() {
  loginForm.hidden = true;
  document.querySelector("#loginHelp").hidden = true;
  showMessage("Login berhasil. Memutar audio sebelum membuka dashboard.", "info");
  if (await startAudio(loginSuccessAudio)) {
    await waitForAudio(loginSuccessAudio);
    window.location.replace("/");
    return;
  }

  audioFallback.textContent = "Putar audio dan buka dashboard";
  audioFallback.hidden = false;
  audioFallback.onclick = async () => {
    audioFallback.hidden = true;
    if (await startAudio(loginSuccessAudio)) await waitForAudio(loginSuccessAudio);
    window.location.replace("/");
  };
}

async function confirmAccess(session) {
  const response = await fetch("/api/datasets", {
    headers: { Accept: "application/json", Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });
  if (response.ok) return true;

  const result = await response.json().catch(() => ({}));
  if (response.status === 403) {
    await authClient.auth.signOut({ scope: "local" });
    showMessage("Akun ini belum mendapat izin. Hubungi administrator proyek.");
    return false;
  }
  if (response.status === 401) {
    await authClient.auth.signOut({ scope: "local" });
    showMessage("Sesi tidak berlaku. Silakan masuk kembali.");
    return false;
  }
  throw new Error(result.error || "Akses dashboard belum tersedia. Coba lagi sebentar.");
}

async function initializeLogin() {
  const status = new URLSearchParams(window.location.search).get("status");
  if (status === "access") showMessage("Akses akun Anda baru saja dicabut. Hubungi administrator untuk memulihkannya.");
  if (status === "expired") showMessage("Sesi berakhir. Silakan masuk kembali.");

  try {
    authClient = await window.dashboardAuth.getClient();
    loginButton.disabled = false;
    const { data, error } = await authClient.auth.getSession();
    if (error) throw error;
    if (data.session && inviteType === "invite") {
      if (await confirmAccess(data.session)) showPasswordSetup(data.session);
      return;
    }
    if (data.session && await confirmAccess(data.session)) window.location.replace("/");
    if (inviteType === "invite" && !data.session) {
      showMessage("Tautan undangan tidak berlaku atau sudah kedaluwarsa. Minta administrator mengirim tautan baru.");
    }
  } catch (error) {
    showMessage(error.message || "Login belum siap. Hubungi administrator proyek.", "info");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.classList.add("hidden");
  const identifier = identifierInput.value.trim();
  const password = passwordInput.value;
  if (!identifier || !password) {
    showMessage("Masukkan nama akhir/NIM dan kata sandi.");
    return;
  }

  setBusy(true);
  try {
    let session;
    if (identifier.includes("@")) {
      const { data, error } = await authClient.auth.signInWithPassword({ email: identifier, password });
      if (error && ![400, 401].includes(error.status)) throw error;
      session = data?.session;
    } else {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifier, password }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        showMessage(result.error || "Nama akhir/NIM atau kata sandi belum benar. Periksa kembali lalu coba lagi.");
        await playFailureAudio();
        return;
      }
      if (!response.ok) throw new Error(result.error || "Layanan login belum tersedia. Coba lagi sebentar.");
      const { data, error } = await authClient.auth.setSession(result);
      if (error) throw error;
      session = data?.session;
    }

    if (!session) {
      showMessage("Nama akhir/NIM atau kata sandi belum benar. Periksa kembali lalu coba lagi.");
      await playFailureAudio();
      return;
    }
    if (await confirmAccess(session)) {
      await playSuccessAudio();
    } else {
      await playFailureAudio();
    }
  } catch (error) {
    showMessage(error.message || "Tidak dapat menghubungi layanan login. Coba lagi sebentar.");
    await playFailureAudio();
  } finally {
    setBusy(false);
  }
});

passwordSetupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.classList.add("hidden");
  const password = newPasswordInput.value;
  if (password.length < 10) {
    showMessage("Kata sandi harus berisi setidaknya 10 karakter.");
    newPasswordInput.focus();
    return;
  }
  if (password !== confirmPasswordInput.value) {
    showMessage("Kata sandi yang diketik belum sama.");
    confirmPasswordInput.focus();
    return;
  }

  setPasswordBusy(true);
  try {
    const { error } = await authClient.auth.updateUser({ password });
    if (error) throw error;
    loginMessage.textContent = "Kata sandi tersimpan. Membuka dashboard…";
    loginMessage.classList.remove("hidden", "login-message-error", "login-message-info");
    loginMessage.classList.add("login-message-info");
    window.setTimeout(() => window.location.replace("/"), 800);
  } catch (error) {
    showMessage(error.message || "Kata sandi belum dapat disimpan. Coba lagi.");
  } finally {
    setPasswordBusy(false);
  }
});

document.querySelector("#togglePassword").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const reveal = passwordInput.type === "password";
  passwordInput.type = reveal ? "text" : "password";
  button.setAttribute("aria-pressed", String(reveal));
  button.setAttribute("aria-label", reveal ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
  button.querySelector(".eye-open").classList.toggle("hidden", reveal);
  button.querySelector(".eye-closed").classList.toggle("hidden", !reveal);
});

initializeLogin();

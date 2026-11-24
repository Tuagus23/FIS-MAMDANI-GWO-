# Fuzzy CH WSN — versi 2

Implementasi baru untuk simulasi pemilihan *cluster head* pada wireless sensor
network. Proyek ini memakai Mamdani, LEACH, dan kalibrasi fungsi keanggotaan
memakai Grey Wolf Optimizer. Sugeno sudah dihapus. Dependensi eksternal yang
digunakan adalah NumPy dan Matplotlib.

## Jalankan

    cd fuzzy-ch-wsn-v2
    py -m pip install -r requirements.txt

    # Bandingkan Mamdani dan LEACH
    py main.py

    # Kalibrasi MF dengan GWO, lalu ikutkan protokol GWO dalam perbandingan
    py main.py --optimize

    # Muat MF yang pernah dikalibrasi
    py main.py --load-mf results/membership_gwo.json

    # Kalibrasi umur jaringan lalu validasi pada 10 topologi baru
    py main.py --optimize --fitness-mode lifetime --wolves 8 --iterations 10 --fitness-seeds 1,2,3,4,5,6,7,8,9,10 --validate-seeds 10

## Dashboard web

Antarmuka produksi memakai **Next.js App Router, React, TypeScript strict, dan Tailwind CSS**.
Setiap menu memiliki URL sendiri: `/`, `/validasi`, `/membership`, `/gwo`, `/fis`,
`/anggota`, `/motto`, dan `/simulasi`. Tautan hash lama serta `/login.html`
tetap kompatibel.

Perhitungan simulasi dan autentikasi tetap dilayani API Python yang sama.
Semua pemeriksaan izin berada di server. Publishable key dikirim lewat
`/api/auth-config`; secret key dan daftar akun tetap di environment server.

Jalankan dari root proyek, dengan Node.js 22 atau lebih baru:

```powershell
npm install
py -m pip install -r requirements.txt
npm run dev:api
```

Di terminal kedua:

```powershell
npm run dev
```

Buka **http://localhost:3000**. API lokal membutuhkan variabel Supabase dan
roster yang sama dengan konfigurasi server. Untuk menggunakan API produksi
saat mengembangkan UI lokal, jalankan Next dengan `DASHBOARD_API_ORIGIN`
berisi origin backend yang Anda kelola; variabel ini hanya dipakai dalam mode development.

```powershell
npm run typecheck
npm run lint
npm run build
npm start
```

`src/app` berisi route Next.js, `src/components` komponen React, `src/lib`
kontrak data dan kalkulasi, serta `public` aset statis. Folder `web` adalah
antarmuka lama untuk kompatibilitas server Python `app.py`; Vercel membangun
UI dari `src` dan output `.next`. Ubah UI baru di `src`, bukan di `web`.

GSAP ScrollTrigger dan Lenis mengelola scroll; Motion menangani hover kartu.
Seluruh listener, chart, dan animasi dibersihkan saat komponen dilepas.
Preferensi pengurangan gerak dan perangkat sentuh dihormati.

### Login dan akses rekan

Dashboard memakai Supabase Auth. Form login menerima NIM atau nama terakhir
yang terdaftar pada roster, lalu langsung membuka dashboard tanpa audio sukses. Tidak
ada pendaftaran publik. Atur variabel berikut pada **Vercel → Project →
Settings → Environment Variables**:

| Nama | Isi |
|---|---|
| `SUPABASE_URL` | URL proyek Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key proyek Supabase |
| `DASHBOARD_ALLOWED_EMAILS` | Daftar email yang boleh masuk, dipisahkan koma |
| `DASHBOARD_LOGIN_USERS` | JSON privat berisi akun roster (nama, NIM atau `login_id`, dan peran) |

Contoh bentuk `DASHBOARD_LOGIN_USERS` (jangan masukkan nomor telepon):

```json
[
  {"nim":"2300000000","name":"Contoh Nama Mahasiswa","role":"member"},
  {"login_id":"supriana","name":"I Wayan Supriana","role":"super_admin"}
]
```

Untuk setiap akun pada JSON itu, buat pengguna di **Supabase → Authentication
→ Users → Add user** dengan alamat internal `<NIM>@auth.fuzzy-ch-wsn-dashboard.vercel.app`;
akun dosen memakai `supriana@auth.fuzzy-ch-wsn-dashboard.vercel.app`. Tandai
email sebagai terkonfirmasi agar Supabase tidak mengirim tautan aktivasi ke
alamat internal. Gunakan kata sandi yang diberikan administrator. Alamat ini
hanya menjadi ID internal untuk Supabase dan tidak menerima email, jadi
pemulihan kata sandi perlu dilakukan administrator. Jangan menyimpan kata sandi
di source code atau variabel roster.

Pengguna masuk menggunakan nama akhir bila unik atau NIM. Nama akhir yang sama
harus dibedakan dengan NIM. Peran dan status akses dibaca dari tabel
`public.dashboard_users` pada setiap permintaan. Nilai `role` dalam roster
lama tidak lagi menjadi sumber izin.

Halaman **Kelola pengguna** (`/pengguna`) hanya tersedia untuk super admin.
Admin dapat mencari akun, mengubah peran, serta mengaktifkan atau menonaktifkan
akses. Semua pengguna aktif tetap dapat menjalankan simulasi dan mengunduh data.
Agus, Adrian, Rama, Wardana, dan I Wayan Supriana ditetapkan sebagai lima super
admin awal. Akun sendiri tidak dapat dinonaktifkan atau diturunkan perannya.
Perubahan dicatat dalam `dashboard_access_log`; versi data mencegah dua admin
menimpa perubahan tanpa memuat ulang.

Terapkan migrasi di `supabase/migrations/` sebelum merilis backend ini. RLS
membatasi user biasa ke profil sendiri; perubahan hanya melalui RPC yang
memeriksa super admin aktif dalam transaksi. API memakai token pengguna dan
publishable key, sehingga tidak memerlukan `service_role` atau secret key.
Tidak ada fallback izin ke roster jika database tidak dapat dihubungi.

Panel mengelola akun yang sudah terdaftar. Pembuatan akun dan penggantian kata
sandi tetap dilakukan lewat Supabase Auth. Untuk menambah akun, buat Auth user
terkonfirmasi, tambahkan pemetaan NIM/nama ke roster server, lalu buat profil
`dashboard_users` dengan UUID Auth yang sama, `login_id` NIM, `role='member'`,
dan `active=true`. Jangan mengizinkan pendaftaran membuat super admin otomatis.

Jalankan `python -m unittest discover -s tests -v` untuk uji API dan izin.
`supabase/tests/dashboard_roles.sql` menguji RLS dan RPC pada database dengan
transaksi yang seluruhnya di-rollback.

Di Supabase **Authentication → URL Configuration**, set Site URL ke
`https://fuzzy-ch-wsn-dashboard.vercel.app` dan tambahkan
`https://fuzzy-ch-wsn-dashboard.vercel.app/login.html` ke daftar redirect.
Undangan email yang memakai Site URL bawaan akan diarahkan otomatis ke formulir
aktivasi di `/login.html`. Matikan pendaftaran publik di **Authentication →
Sign In / Providers**. Akun email individual dapat diundang dari
**Authentication → Users → Add user → Send invitation** dan harus ditambahkan
ke `DASHBOARD_ALLOWED_EMAILS`. Setelah memperbarui variabel lingkungan, buat
deployment Vercel baru. API memeriksa sesi dan daftar akun pada setiap
permintaan data maupun simulasi. Jangan gunakan `service_role` atau secret key
di browser.

Supabase SMTP bawaan hanya mengirim email autentikasi kepada anggota organisasi
Supabase. Untuk mengundang rekan di luar organisasi, konfigurasi SMTP khusus di
Supabase sebelum mengirim undangan.

Tanpa konfigurasi Supabase, halaman masuk tetap tampil tetapi data dan simulasi
tidak tersedia. Jika repository GitHub masih publik, login dashboard tidak
menyembunyikan kode maupun file hasil yang tersedia di repository.

Dashboard menampilkan ringkasan eksperimen, hasil validasi topologi, kurva
fungsi keanggotaan, dan simulasi baru untuk membandingkan FUZZY, LEACH, serta
GWO. Run simulasi memakai MF GWO dari `results/membership_gwo.json`; optimizer
tidak dijalankan ulang. Parameter simulasi dibatasi hingga 60 node dan 2.000
ronde agar layanan bersama tetap responsif.

Parameter utama:

| Argumen | Default | Fungsi |
|---|---:|---|
| **--nodes** | 30 | Jumlah node sensor |
| **--rounds** | 1600 | Horizon simulasi protokol |
| **--ch-count** | 1 | Jumlah node berskor tertinggi yang dipilih sebagai CH |
| **--wolves** | 8 | Jumlah kandidat GWO |
| **--iterations** | 10 | Iterasi pembaruan GWO |
| **--fitness-rounds** | sama dengan **--rounds** | Horizon setiap evaluasi fitness |
| **--fitness-seeds** | **1–10** | Seed topologi tetap untuk evaluasi fitness |
| **--fitness-mode** | **lifetime** | Bobot tujuan **balanced** atau **lifetime** |
| **--validate-seeds** | 0 | Topologi tambahan untuk membandingkan FUZZY vs GWO |
| **--output-dir** | **results** | Folder file hasil |

Contoh memperkecil eksperimen untuk eksplorasi:

    py main.py --optimize --wolves 4 --iterations 3 --fitness-rounds 300 --fitness-seeds 1,2

## Cara kerja GWO dalam proyek

GWO tidak memilih node secara langsung. Ia mencari 13 koordinat ternormalisasi
dalam [0, 1]: tiga titik transisi untuk energi, lima untuk jarak, dan lima
untuk jumlah tetangga. Representasi ini dapat menyimpan kurva awal dari lampiran
secara tepat, lalu menggeser tiap transisi dengan tetap menjaga urutan dan jarak
minimum antartitik.

Untuk satu wolf X, GWO menghitung tiga usulan berdasarkan wolf terbaik saat ini,
yaitu alpha, beta, dan delta:

    Dα = |C1 · Xα - X|       Yα = Xα - A1 · Dα
    Dβ = |C2 · Xβ - X|       Yβ = Xβ - A2 · Dβ
    Dδ = |C3 · Xδ - X|       Yδ = Xδ - A3 · Dδ

    X baru = clip((Yα + Yβ + Yδ) / 3, 0, 1)
    A = a(2r1 - 1)            C = 2r2

Operasi dilakukan per koordinat. r1 dan r2 adalah vektor acak pada [0,1];
a turun linier dari 2 ke 0. Karena itu perpindahan awal bisa menjelajahi ruang
parameter yang luas, sedangkan iterasi akhir berkumpul di sekitar tiga kandidat
terbaik. Nilai terbaik sepanjang run disimpan terpisah sebagai solusi akhir.

Setiap kandidat diubah menjadi MF, lalu diuji pada topologi yang sama untuk
setiap seed yang dipilih. Fitness adalah rata-rata skor simulasi:

    balanced =
        0.10 × FND/H + 0.20 × R10/H + 0.25 × HND/H + 0.25 × R90/H
      + 0.10 × fraksi energi tersisa + 0.10 × PDR/100

    lifetime =
        0.30 × FND/H + 0.30 × R10/H + 0.30 × HND/H
      + 0.30 × R90/H + 0.30 × LND/H
      + 0.30 × fraksi energi node terkuat + 0.30 × PDR/100

H adalah horizon evaluasi. R10, HND, dan R90 adalah ronde ketika sedikitnya
10%, 50%, dan 90% node mati; LND adalah ronde saat node terakhir mati.
FND adalah ronde kematian node pertama dan mendapat bobot langsung. Semua tujuh
komponen aktif pada mode **lifetime** berbobot sama, yaitu 0.30; skor dibagi
jumlah bobot agar tetap ternormalisasi.

Setelah optimasi, MF terbaik dipakai oleh Mamdani untuk memberi skor ke node.
Satu node dengan skor tertinggi dipilih sebagai CH sesuai lampiran awal; jumlah
ini bisa diubah dengan **--ch-count**. LEACH tetap memakai ambang probabilistik.
Optimizer memakai seed tetap dan topologi evaluasi yang sama pada setiap
kandidat agar perubahan skor berasal dari parameter MF, bukan perubahan
topologi.

## Model simulasi

- Node ditempatkan acak dengan seed tetap di area persegi; base station berada
  di tengah.
- Node non-CH mengirim ke CH terdekat. CH menerima dan mengagregasi paket,
  kemudian mengirim satu frame agregat ke base station.
- PDR menghitung jumlah pembacaan node yang terantar, termasuk pembacaan yang
  dibawa dalam frame agregat.
- LEACH memakai ambang probabilistik dan periode rotasi CH.
- FUZZY memakai MF baseline dan GWO memakai MF hasil kalibrasi.

MF baseline dan 27 aturan Mamdani mengikuti definisi pada lampiran awal dan
proyek sebelumnya. GWO mengoptimalkan 13 titik transisi pada kurva input: tiga
titik energi, lima titik jarak, dan lima titik jumlah tetangga. MF output dan
basis aturan tetap, sehingga GWO mengkalibrasi bentuk kurva input tanpa mengubah
konsekuen aturan.
Titik MF baseline ditulis sebagai berikut (trap = trapesium, tri = segitiga):

| Variabel | Rendah / Sedikit / Dekat | Sedang | Tinggi / Banyak / Jauh |
|---|---|---|---|
| Energi (0–1) | Rendah: trap (0, 0, 0.3, 0.5) | tri (0.3, 0.5, 0.7) | Tinggi: trap (0.5, 0.7, 1, 1) |
| Jarak (0–100 m) | Dekat: trap (0, 0, 20, 40) | tri (20, 50, 80) | Jauh: trap (60, 80, 100, 100) |
| Tetangga (0–20) | Sedikit: trap (0, 0, 3, 6) | tri (3, 7, 12) | Banyak: trap (8, 12, 20, 20) |
| Output (0–1) | Rendah: trap (0, 0, 0.3, 0.5) | tri (0.3, 0.5, 0.7) | Tinggi: trap (0.5, 0.7, 1, 1) |

Hasil disimpan sebagai **protocol_summary.csv** dan **round_metrics.csv**.
Setiap run menghasilkan kurva MF **mf_energy.png**, **mf_distance.png**,
**mf_neighbors.png**, dan **mf_output.png**, serta tabel rules
**fuzzy_rules.csv** dan **fuzzy_rule_base.png**. Saat MF GWO tersedia, grafik
input menampilkan MF baseline dengan garis utuh dan MF hasil GWO dengan garis
putus-putus. Kurva output tetap sesuai lampiran. Urutan aturan pada CSV dan
gambar mengikuti proyek sebelumnya.
Grafik kinerja **lifetime_metrics.png** (FND, HND, LND) dan **pdr_comparison.png**
juga dibuat. Saat kalibrasi, program menyimpan
**membership_gwo.json**, **gwo_history.csv**, dan **calibration_report.json**.
Detail evaluasi tiap wolf pada populasi awal dan setiap pembaruan posisi juga
disimpan di **gwo_wolf_fitness.csv** (fitness, metrik pembentuk, peringkat,
peran, tanda **is_alpha**, dan 13 koordinat MF) serta divisualisasikan di
**gwo_wolf_fitness.png**. Bintang pada grafik menandai alpha di tiap iterasi;
**gwo_alpha_history.csv** dan **gwo_alpha_history.png** menunjukkan wolf yang
memegang peran alpha pada setiap populasi. CSV menyertakan **id** evaluasi unik
dan **no_iterasi** (0 = populasi awal).
Wolf pada generasi akhir diringkas di **gwo_final_wolves.csv**; satu gambar per
wolf di **gwo_final_wolf_plots/** menampilkan kurva MF input dan milestone
lifetime hasil evaluasi fitness. Solusi terbaik sepanjang optimasi, yang dipakai
untuk simulasi akhir, ditandai di **gwo_best_solution.csv** bersama kandidat
fitness tertinggi yang diamati untuk tiap wolf; kolom **selected_global_best**
menunjukkan solusi terpilih. Gambar **gwo_best_solution.png** menampilkan solusi
global tersebut.
Validasi topologi disimpan per seed di **validation.csv** dan diringkas di
**validation_summary.csv**. Untuk menghitung rata-rata ringkasan, milestone
yang belum tercapai diberi nilai batas horizon; baris seed mentah tetap kosong
pada milestone tersebut. Nilai **n/r** pada grafik lifetime juga berarti
milestone belum tercapai dalam horizon simulasi. Ringkasan juga memuat
**lifetime_index**, yaitu rata-rata FND, HND, dan LND yang masing-masing
dinormalisasi terhadap horizon dan diberi bobot sama.

Folder **optimasi_seed42_weight030/** berisi run dengan 8 wolf, 10 iterasi,
seed latihan 42, dan validasi 10 seed lain. Karena seed 42 ikut latihan, hasil
pada seed itu bukan pengujian independen. Untuk penelitian umum, gunakan seed
latihan dan validasi yang terpisah sesuai rancangan eksperimen.

Jalankan kalibrasi khusus seed 42 dengan:

    py main.py --optimize --fitness-mode lifetime --wolves 8 --iterations 10 --fitness-rounds 1600 --fitness-seeds 42 --validate-seeds 10 --output-dir optimasi_seed42_weight030

## Isi proyek

    main.py                    CLI dan ekspor hasil
    wsn_gwo_v2/config.py        Konfigurasi eksperimen
    wsn_gwo_v2/fuzzy/           MembershipFunction, rule base, encoder, FIS
    wsn_gwo_v2/wsn/             Node, feature extractor, radio, selector, simulator
    wsn_gwo_v2/optimization/    GWO, evaluator fitness, dan kalibrasi
    wsn_gwo_v2/experiment.py    ExperimentRunner, validasi, dan ResultWriter
    wsn_gwo_v2/visualization/   ResultPlotter untuk kurva MF dan grafik kinerja

Setiap kelas punya satu tanggung jawab utama:

| Kelas | Peran |
|---|---|
| **MembershipFunction**, **MembershipSet** | Menyimpan dan mengevaluasi MF |
| **FuzzyRuleBase**, **MamdaniFIS** | Aturan dan inferensi fuzzy |
| **MFEncoder** | Memetakan vektor GWO ke MF yang valid |
| **ClusterHeadSelector** dan turunannya | Memilih CH dengan strategi per protokol |
| **NetworkFeatureExtractor**, **RadioEnergyModel** | Menghitung input node dan biaya energi |
| **NetworkState**, **ClusterCommunication** | Mengelola node, cluster, dan pengiriman |
| **SimulationMetrics**, **NetworkSimulator** | Mencatat metrik dan mengatur ronde |
| **FitnessEvaluator**, **MFOptimizer**, **GreyWolfOptimizer** | Menilai dan mengoptimalkan MF |
| **ExperimentRunner**, **ResultWriter**, **ResultPlotter** | Menjalankan, menyimpan, dan memvisualisasikan hasil |

NetworkSimulator mengatur urutan ronde; fitur, seleksi CH, konsumsi energi,
pencatatan metrik, dan evaluasi kandidat didelegasikan ke objek khusus. Untuk
menambah protokol, implementasikan ClusterHeadSelector lalu daftarkan di
SelectorFactory.


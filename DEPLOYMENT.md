# Deploy ke PythonAnywhere tanpa kartu

PythonAnywhere dapat menjalankan API dan UI HTML/CSS/JS proyek ini melalui WSGI.
Gunakan akun gratis untuk satu web app. Akun gratis baru memiliki satu worker,
ruang disk 512 MiB, dan masa aktif aplikasi satu bulan; aplikasi perlu diperpanjang
melalui dashboard secara berkala.

1. Buat atau masuk ke akun PythonAnywhere, lalu buka **Web > Add a new web app**.
2. Pilih **Manual configuration** dan Python 3.11.
3. Buka konsol Bash, lalu clone repo publik dan pasang dependensi:

   ```bash
   git clone https://github.com/Tuagus23/FIS-MAMDANI-GWO-.git fuzzy-ch-wsn
   cd fuzzy-ch-wsn
   mkvirtualenv --python=/usr/bin/python3.11 fuzzy-wsn
   pip install -r requirements.txt
   ```

4. Pada bagian **Code**, atur source code dan working directory ke
   `/home/<username>/fuzzy-ch-wsn`.
5. Buka file konfigurasi WSGI dari tab **Web**. Ganti isinya dengan konfigurasi
   berikut, lalu sesuaikan username:

   ```python
   import sys

   project_path = "/home/<username>/fuzzy-ch-wsn"
   if project_path not in sys.path:
       sys.path.insert(0, project_path)

   from pythonanywhere_wsgi import application
   ```

6. Pilih virtualenv `fuzzy-wsn`, tekan **Reload**, lalu buka alamat
   `https://<username>.pythonanywhere.com`.

PythonAnywhere free account dibatasi satu web app dan satu worker. Untuk akun
gratis baru, aplikasi kedaluwarsa setelah satu bulan sehingga perlu diperpanjang.

# Opsi Render

Antarmuka memakai HTML, CSS, JavaScript, dan Tailwind CSS yang telah dikompilasi.
Python tetap menjalankan API dan simulasi. Berkas `render.yaml` menyiapkan
perintah build, start, health check, dan plan Free.

1. Masuk ke Render dan pilih **New > Blueprint**.
2. Hubungkan repo `Tuagus23/FIS-MAMDANI-GWO-` pada branch `main`.
3. Tinjau konfigurasi dari `render.yaml`, termasuk plan layanan yang dipilih.
4. Buat layanan. Setelah build selesai, Render menampilkan URL `onrender.com`.

Repo GitHub ini publik, sehingga kode dan data yang sudah ada di repo dapat
dilihat siapa saja. Web service Render juga dapat diakses publik lewat URL-nya.
Pilih plan hosting yang sesuai sebelum membuat layanan.

# Vercel — Next.js + Python

Antarmuka produksi memakai Next.js App Router (React + TypeScript).
API Python tetap berada di `api/[...path].py` dengan pemeriksaan izin di server.

1. Hubungkan repo `Tuagus23/FIS-MAMDANI-GWO-`, branch produksi `main`.
2. Root Directory adalah root repo. Framework **Next.js**, build `npm run build`,
   output `.next`; konfigurasi ini juga tercatat di `vercel.json`.
3. Pertahankan variabel Supabase dan roster pada environment server. Lihat README.
4. Push branch lain menghasilkan Preview; push `main` menghasilkan Production.
5. Cek `/api/health`, `/api/auth-config`, login, dataset, grafik, dan simulasi.

Halaman baru menggunakan `/login`, `/validasi`, `/membership`, `/gwo`, `/fis`,
`/anggota`, `/motto`, dan `/simulasi`. `/login.html` dialihkan ke `/login`,
dan hash lama diarahkan oleh aplikasi ke URL halaman yang sesuai.

Dashboard memerlukan akun yang diizinkan. Simulasi dibatasi maksimal 60 node
dan 2.000 ronde. Algoritme dan sumber CSV tetap memakai proyek Python yang sama.

Panduan PythonAnywhere/Render di atas adalah jalur server Python lama yang
menyajikan folder `web`, bukan antarmuka Next.js baru. Untuk pengembangan
antarmuka baru gunakan `npm run dev` bersama `npm run dev:api`.

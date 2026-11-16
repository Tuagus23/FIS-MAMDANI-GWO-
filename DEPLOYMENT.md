# Deploy ke Render

Antarmuka memakai HTML, CSS, JavaScript, dan Tailwind CSS yang telah dikompilasi.
Python tetap menjalankan API dan simulasi. Berkas `render.yaml` menyiapkan
perintah build, start, serta health check.

1. Masuk ke Render dan pilih **New > Blueprint**.
2. Hubungkan repo `Tuagus23/FIS-MAMDANI-GWO-` pada branch `main`.
3. Tinjau konfigurasi dari `render.yaml`, termasuk plan layanan yang dipilih.
4. Buat layanan. Setelah build selesai, Render menampilkan URL `onrender.com`.

Repo GitHub ini publik, sehingga kode dan data yang sudah ada di repo dapat
dilihat siapa saja. Web service Render juga dapat diakses publik lewat URL-nya.
Pilih plan hosting yang sesuai sebelum membuat layanan.


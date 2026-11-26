import Link from "next/link";
import styles from "./project-basis.module.css";

const papers = {
  hamzah: {
    author: "Hamzah dkk. (2019)",
    title: "Energy-Efficient Fuzzy-Logic-Based Clustering Technique for Hierarchical Routing Protocols in Wireless Sensor Networks",
    doi: "10.3390/s19030561",
    page: "Bagian 3.2, PDF hlm. 8",
    quote: "taken based on the trial-and-error method over tens of experiments",
  },
  mirjalili: {
    author: "Mirjalili, Mirjalili, dan Lewis (2014)",
    title: "Grey Wolf Optimizer",
    doi: "10.1016/j.advengsoft.2013.12.007",
    page: "Abstrak, PDF hlm. 1",
    quote: "very competitive results compared to these well-known meta-heuristics",
  },
  zhang: {
    author: "Zhang, Wang, dan Zhang (2009)",
    title: "Genetic Optimization of Fuzzy Membership Functions",
    doi: "10.1109/ICWAPR.2009.5207463",
    page: "Bagian 2, PDF hlm. 2 (hlm. 466 pada prosiding)",
    quote: "assume the fuzzy control rules are predefined",
  },
  verma: {
    author: "Verma dan Baliyan (2021)",
    title: "Grey Wolf Optimization with Fuzzy Logic for Energy-Efficient Communication in Wireless Sensor Network-Based Internet of Things Scenario",
    doi: "10.1002/dac.4981",
    page: "Ringkasan, PDF hlm. 1",
    quote: "CH selection is accomplished using fuzzy inference-based system",
  },
  sennan: {
    author: "Sennan dkk. (2026)",
    title: "A Multi-Objective Grey Wolf Optimization Algorithm for Energy-Efficient Cluster-Based Routing in IoT-Enabled WSNs",
    doi: "10.1038/s41598-025-28950-2",
    page: "Abstrak, PDF hlm. 1",
    quote: "fitness function that uses fuzzy logic to evaluate potential CHs",
  },
  herrera: {
    author: "Herrera, Lozano, dan Verdegay (1995)",
    title: "Tuning Fuzzy Logic Controllers by Genetic Algorithms",
    doi: "10.1016/0888-613X(94)00033-Y",
    page: "Abstrak, PDF hlm. 1 (hlm. 299 pada jurnal)",
    quote: "depends on its control rules and membership functions",
  },
  wang: {
    author: "Wang (2023)",
    title: "A Distributed Particle-Swarm-Optimization-Based Fuzzy Clustering Protocol for Wireless Sensor Networks",
    doi: "10.3390/s23156699",
    page: "Abstrak, PDF hlm. 1",
    quote: "applied to optimize the fuzzy rules",
  },
  giri: {
    author: "Giri, Dutta, dan Neogy (2022)",
    title: "An Optimized Fuzzy Clustering Algorithm for Wireless Sensor Networks",
    doi: "10.1007/s11277-022-09839-z",
    page: "Abstrak, PDF hlm. 1 (hlm. 2731 pada jurnal)",
    quote: "an energy efficient routing path is determined utilizing other cluster heads",
  },
  zehra: {
    author: "Zehra dkk. (2024)",
    title: "A Grey Wolf-Driven Refinement of Fuzzy-Based Controller for Enhanced DC Microgrid Operation",
    doi: "10.1109/FUZZ-IEEE60900.2024.10611774",
    page: "Abstrak, PDF hlm. 1",
    quote: "selecting the spread of membership functions of the FIS through GWO",
  },
} as const;

type Paper = keyof typeof papers;

const topics = [
  { id: "fuzzy-manual", short: "Fuzzy manual", title: "Mengapa fuzzy manual belum tentu optimal?" },
  { id: "pilihan-gwo", short: "GWO, GA, dan PSO", title: "Mengapa memilih GWO?" },
  { id: "studi-gwo", short: "Studi GWO terdahulu", title: "Apakah GWO sudah digunakan pada WSN?" },
  { id: "mf-dan-aturan", short: "MF dan basis aturan", title: "Mengapa menyetel MF dan mempertahankan aturan?" },
  { id: "celah-literatur", short: "Celah literatur", title: "Celah apa yang diuji proyek ini?" },
] as const;

function Source({ paper }: { paper: Paper }) {
  return <a href={`#rujukan-${paper}`}>{papers[paper].author}</a>;
}

function Excerpt({ paper }: { paper: Paper }) {
  const { quote, page, doi } = papers[paper];
  return (
    <figure className={styles.excerpt}>
      <blockquote lang="en" cite={`https://doi.org/${doi}`}>“{quote}”</blockquote>
      <figcaption><Source paper={paper} /> · {page}</figcaption>
    </figure>
  );
}

function Answer({
  topic,
  children,
}: {
  topic: (typeof topics)[number];
  children: React.ReactNode;
}) {
  return (
    <section id={topic.id} className={styles.answer} aria-labelledby={`${topic.id}-judul`}>
      <h2 id={`${topic.id}-judul`}>{topic.title}</h2>
      {children}
    </section>
  );
}

export function ProjectBasis() {
  return (
    <div className={styles.page}>
      <section className={styles.intro} aria-labelledby="pertanyaan-penelitian">
        <h2 id="pertanyaan-penelitian">
          Bisakah penyetelan kurva fuzzy memperpanjang umur jaringan sensor?
        </h2>
        <div className={styles.introColumns}>
          <div>
            <h3>Masalah yang dihadapi</h3>
            <p>
              Node sensor memakai baterai terbatas. Cluster head (CH) menerima,
              menggabungkan, dan meneruskan data anggotanya ke stasiun pangkalan.
              Pemilihan CH yang kurang sesuai dapat menguras energi node lebih awal.
              {" "}<Source paper="hamzah" />
            </p>
          </div>
          <div>
            <h3>Tujuan proyek</h3>
            <p>
              Menguji apakah kurva fuzzy yang dikalibrasi dengan Grey Wolf Optimizer
              (GWO) membantu memilih CH dan memperpanjang umur jaringan. Umur node
              dan keberhasilan pengiriman paket diukur bersama agar komprominya terlihat.
            </p>
          </div>
        </div>
      </section>

      <div className={styles.readingLayout}>
        <nav className={styles.contents} aria-label="Daftar isi Dasar proyek">
          <h2>Di halaman ini</h2>
          <ol>
            {topics.map(({ id, short }) => <li key={id}><a href={`#${id}`}>{short}</a></li>)}
          </ol>
          <a href="#daftar-pustaka">Daftar pustaka</a>
        </nav>

        <div className={styles.article}>
          <Answer topic={topics[0]}>
            <p>
              Fuzzy manual memberi skor CH dari energi sisa, jarak ke stasiun
              pangkalan, dan jumlah tetangga. Letak ambang pada fungsi keanggotaan
              (membership function atau MF) menentukan seberapa kuat input masuk
              ke kategori seperti “energi tinggi”. Pergeseran ambang dapat mengubah
              aturan yang aktif, skor, dan urutan kandidat CH.
            </p>
            <p>
              Hamzah dkk. membangun jumlah dan tumpang tindih MF melalui percobaan
              berulang. Kurva awal di proyek ini berfungsi sebagai baseline.
              Kalibrasi mencari kurva dengan fitness simulasi yang lebih baik pada
              topologi dan bobot yang ditetapkan.
            </p>
            <Excerpt paper="hamzah" />
          </Answer>

          <Answer topic={topics[1]}>
            <p>
              GWO dipilih karena kandidat di proyek ini berupa 13 koordinat kontinu
              yang bisa dibatasi dan diubah menjadi kurva yang valid. Posisi alpha,
              beta, dan delta memandu pencarian. Fitness dihitung dari hasil
              simulasi sehingga pencarian dapat berjalan tanpa turunan fungsi tujuan.
              Implementasinya dapat ditelusuri di <Link href="/gwo">Proses GWO</Link>.
            </p>
            <dl className={styles.comparisons}>
              <div>
                <dt>Algoritma genetika (GA)</dt>
                <dd>
                  GA dengan pengodean bilangan riil juga bisa menyetel MF.
                  Zhang dkk. memberi contoh pada pengendali fuzzy. <Source paper="zhang" />
                </dd>
              </div>
              <div>
                <dt>Particle Swarm Optimization (PSO)</dt>
                <dd>
                  PSO juga layak diuji dengan representasi yang sama. Pada WSN,
                  Giri dkk. memakai PSO untuk rute, sementara Wang memakainya
                  untuk menyetel aturan fuzzy. <Source paper="giri" /> · <Source paper="wang" />
                </dd>
              </div>
            </dl>
            <p>
              Benchmark awal Mirjalili dkk. mendukung kelayakan GWO sebagai
              metode pencarian. Proyek ini membandingkan konfigurasi FIS
              sebelum dan sesudah kalibrasi GWO. Peringkat GWO, GA, PSO, atau
              metode lain memerlukan perbandingan langsung dengan fitness,
              seed, dan jumlah evaluasi yang sama.
            </p>
            <Excerpt paper="mirjalili" />
          </Answer>

          <Answer topic={topics[2]}>
            <p>
              Ya. Studi terdahulu menggabungkan GWO dan fuzzy pada WSN, dengan
              sasaran optimasi yang berbeda.
            </p>
            <dl className={styles.comparisons}>
              <div>
                <dt><Source paper="verma" /></dt>
                <dd>GWO membentuk klaster. Sistem inferensi fuzzy memilih CH.</dd>
              </div>
              <div>
                <dt><Source paper="sennan" /></dt>
                <dd>
                  MOGWO mencari konfigurasi CH dengan fitness berbasis fuzzy
                  yang memakai jarak, jumlah tetangga, dan energi sisa.
                </dd>
              </div>
            </dl>
            <Excerpt paper="verma" />
            <Excerpt paper="sennan" />
          </Answer>

          <Answer topic={topics[3]}>
            <p>
              Proyek ini ingin mengukur pengaruh kalibrasi kurva input. FUZZY
              dan GWO menggunakan 27 aturan Mamdani dan kurva output yang sama.
              GWO menyetel tiga koordinat energi, lima koordinat jarak, dan lima
              koordinat jumlah tetangga. Dengan penataan ini, perubahan hasil
              antara kedua konfigurasi dapat ditelusuri ke kurva input.
            </p>
            <p>
              Herrera dkk. menunjukkan bahwa aturan dan MF sama-sama berpengaruh.
              Zhang dkk. memberi contoh kalibrasi MF dengan aturan yang sudah
              ditetapkan, sementara Wang menunjukkan jalur lain dengan menyetel
              aturan. Untuk menguji keduanya, perlu skenario terpisah untuk MF saja,
              aturan saja, dan kombinasi keduanya, dengan anggaran evaluasi setara.
            </p>
            <Excerpt paper="herrera" />
            <Excerpt paper="zhang" />
            <Excerpt paper="wang" />
            <Link className={styles.inlineAction} href="/membership">Bandingkan kurva MF awal dan GWO</Link>
          </Answer>

          <Answer topic={topics[4]}>
            <p>
              Dari paper yang ditelaah, metode yang paling dekat memakai GWO untuk
              klaster atau pemilihan CH di WSN. Zehra dkk. langsung menyetel MF
              dengan GWO pada pengendali mikrogrid. Giri dkk. memakai masukan fuzzy
              yang serupa di WSN dan menempatkan optimasi PSO pada pemilihan rute.
            </p>
            <Excerpt paper="giri" />
            <Excerpt paper="zehra" />
            <div className={styles.finding}>
              <h3>Celah yang diuji dalam proyek</h3>
              <p>
                Berapa besar pengaruh penyetelan MF input dengan GWO terhadap umur
                jaringan dan pengiriman paket ketika aturan Mamdani tetap dan
                topologi pengujian dipisahkan dari kalibrasi? Pada rujukan terdekat
                di atas, pengaruh perubahan kurva belum diuji secara terpisah
                dengan rancangan WSN ini.
              </p>
            </div>
            <ol className={styles.method} aria-label="Rancangan eksperimen">
              <li><strong>Kalibrasi</strong><span>GWO mencari titik kurva input pada seed topologi kalibrasi.</span></li>
              <li><strong>Bandingkan</strong><span>FUZZY dan GWO memakai aturan dan topologi berpasangan. LEACH menjadi pembanding pada ringkasan eksperimen.</span></li>
              <li><strong>Validasi</strong><span>Bandingkan FUZZY dan GWO pada 10 seed uji terpisah. Baca ronde kematian node (FND, HND, LND) dan rasio paket yang diterima (PDR).</span></li>
            </ol>
            <p>
              Seed 42 pada eksperimen yang dikalibrasi dengan seed 42 termasuk
              data kalibrasi. Hasil pada seed itu menggambarkan kinerja dalam
              skenario tersebut. Bukti di luar kalibrasi berasal dari seed uji
              terpisah.
            </p>
            <Link className={styles.inlineAction} href="/validasi">Lihat hasil validasi model</Link>
          </Answer>

          <section id="daftar-pustaka" className={styles.answer} aria-labelledby="judul-pustaka">
            <h2 id="judul-pustaka">Daftar pustaka</h2>
            <p>Nomor halaman pada kutipan mengikuti urutan di berkas PDF yang ditelaah.</p>
            <ol className={styles.references}>
              {Object.entries(papers).map(([id, paper]) => (
                <li key={id} id={`rujukan-${id}`}>
                  <strong>{paper.author}</strong>
                  <cite lang="en">{paper.title}</cite>
                  <a href={`https://doi.org/${paper.doi}`} aria-label={`Buka paper ${paper.author}`}>DOI {paper.doi}</a>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

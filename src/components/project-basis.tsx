import Link from "next/link";
import { ProjectBasisContents } from "./project-basis-contents";
import styles from "./project-basis.module.css";

const papers = {
  hamzah: {
    author: "Hamzah dkk. (2019)",
    title: "Energy-Efficient Fuzzy-Logic-Based Clustering Technique for Hierarchical Routing Protocols in Wireless Sensor Networks",
    doi: "10.3390/s19030561",
    page: "Bagian 3.2, PDF hlm. 8",
    quote: "The number of membership functions and their overlaps for each of the inputs/output linguistic variables are taken based on the trial-and-error method […]",
    meaning: "Jumlah fungsi keanggotaan dan tumpang tindihnya ditetapkan melalui proses coba-coba.",
  },
  mirjalili: {
    author: "Mirjalili, Mirjalili, dan Lewis (2014)",
    title: "Grey Wolf Optimizer",
    doi: "10.1016/j.advengsoft.2013.12.007",
    page: "Abstrak, PDF hlm. 1",
    quote: "The results show that the GWO algorithm is able to provide very competitive results compared to these well-known meta-heuristics.",
    meaning: "GWO memberi hasil yang kompetitif terhadap metode pembanding pada pengujian paper tersebut.",
  },
  zhang: {
    author: "Zhang, Wang, dan Zhang (2009)",
    title: "Genetic Optimization of Fuzzy Membership Functions",
    doi: "10.1109/ICWAPR.2009.5207463",
    page: "Bagian 2, PDF hlm. 2 (hlm. 466 pada prosiding)",
    quote: "assume the fuzzy control rules are predefined",
    meaning: "Metode penyetelan MF ini memakai aturan fuzzy yang sudah ditetapkan.",
  },
  tremante: {
    author: "Tremante, Yen, dan Brea (2019)",
    title: "Tuning of the Membership Functions of a Fuzzy Control System Using Pattern Search Optimization Method",
    doi: "10.3233/JIFS-190003",
    page: "Abstrak, PDF hlm. 1 (naskah penulis)",
    quote: "If this adjust is done through a ‘trial and error’ procedure, then it will be very time-consuming and difficult to reach a good performance.",
    meaning: "Jika penyesuaian ini dilakukan melalui prosedur coba-coba, prosesnya akan sangat memakan waktu dan sulit mencapai performa yang baik.",
  },
  verma: {
    author: "Verma dan Baliyan (2021)",
    title: "Grey Wolf Optimization with Fuzzy Logic for Energy-Efficient Communication in Wireless Sensor Network-Based Internet of Things Scenario",
    doi: "10.1002/dac.4981",
    page: "Ringkasan, PDF hlm. 1",
    quote: "Clustering is achieved using nature-inspired grey wolf optimization (GWO) algorithm, and CH selection is accomplished using fuzzy inference-based system.",
    meaning: "GWO dipakai untuk membentuk klaster. Pemilihan cluster head dilakukan dengan inferensi fuzzy.",
  },
  sennan: {
    author: "Sennan dkk. (2026)",
    title: "A Multi-Objective Grey Wolf Optimization Algorithm for Energy-Efficient Cluster-Based Routing in IoT-Enabled WSNs",
    doi: "10.1038/s41598-025-28950-2",
    page: "Abstrak, PDF hlm. 1",
    quote: "MOGWO employs a fitness function that uses fuzzy logic to evaluate potential CHs based on distance, number of neighbouring nodes, and residual energy.",
    meaning: "MOGWO memakai fuzzy di dalam fungsi fitness untuk menilai kandidat cluster head dari tiga kondisi node.",
  },
  herrera: {
    author: "Herrera, Lozano, dan Verdegay (1995)",
    title: "Tuning Fuzzy Logic Controllers by Genetic Algorithms",
    publication: "International Journal of Approximate Reasoning, 12(3–4), 299–315.",
    doi: "10.1016/0888-613X(94)00033-Y",
    page: "Abstrak, PDF hlm. 1 (hlm. 299 pada jurnal)",
    quote: "The performance of a fuzzy logic controller depends on its control rules and membership functions.",
    meaning: "Performa pengendali fuzzy dipengaruhi oleh aturan dan fungsi keanggotaan.",
  },
  wang: {
    author: "Wang (2023)",
    title: "A Distributed Particle-Swarm-Optimization-Based Fuzzy Clustering Protocol for Wireless Sensor Networks",
    doi: "10.3390/s23156699",
    page: "Persamaan 5, PDF hlm. 11",
    quote: "maximizes the chance value by the defuzzifier",
    meaning: "Saat menyetel aturan dengan PSO, Wang menilai kandidat dari skor Chance yang dihasilkan defuzzifikasi.",
  },
  ghosh: {
    author: "Ghosh, Banerjee, dan Sherratt (2019)",
    title: "On-Demand Fuzzy Clustering and Ant-Colony Optimisation Based Mobile Data Collection in Wireless Sensor Network",
    doi: "10.1007/s11276-017-1635-6",
    page: "Persamaan 15, PDF hlm. 18 (hlm. 16 pada naskah)",
    quote: "Thus, Chance is considered to be the fitness function",
    meaning: "Saat menyetel MF dengan PSO, studi ini memakai skor kelayakan cluster head sebagai fitness.",
  },
  laxman: {
    author: "Laxman, Annamraju, dan Srikanth (2021)",
    title: "A Grey Wolf Optimized Fuzzy Logic Based MPPT for Shaded Solar Photovoltaic Systems in Microgrids",
    doi: "10.1016/j.ijhydene.2020.12.158",
    page: "PDF hlm. 4 (hlm. 10656 pada jurnal)",
    quote: "easy implementation structure, less number of controlling parameters and simplicity",
    meaning: "Penulis memakai kesederhanaan implementasi dan sedikitnya parameter pengendali sebagai alasan memilih GWO pada pengendali panel surya.",
  },
  rohilla: {
    author: "Rohilla dkk. (2022)",
    title: "Grey Wolf and Fuzzy Logic Based Enhanced Clustering Approach for Energy Efficient Operation of Wireless Sensor Networks",
    doi: "10.1109/ICCES54183.2022.9835880",
    page: "Persamaan 14, PDF hlm. 5 (hlm. 599 pada prosiding)",
    quote: "These weights designate the priority of fitness components.",
    meaning: "Bobot menyatakan prioritas setiap komponen ketika beberapa kriteria digabung menjadi satu fitness.",
  },
  giri: {
    author: "Giri, Dutta, dan Neogy (2022)",
    title: "An Optimized Fuzzy Clustering Algorithm for Wireless Sensor Networks",
    doi: "10.1007/s11277-022-09839-z",
    page: "Abstrak, PDF hlm. 1 (hlm. 2731 pada jurnal)",
    quote: "an energy efficient routing path is determined utilizing other cluster heads by particle swarm optimization",
    meaning: "Dalam studi ini, PSO mencari rute hemat energi melalui cluster head lain.",
  },
  zehra: {
    author: "Zehra dkk. (2024)",
    title: "A Grey Wolf-Driven Refinement of Fuzzy-Based Controller for Enhanced DC Microgrid Operation",
    doi: "10.1109/FUZZ-IEEE60900.2024.10611774",
    page: "Abstrak, PDF hlm. 1",
    quote: "to eliminate the hit-and-trial method for selecting the spread of membership functions of the FIS through GWO",
    meaning: "Zehra dkk. menggunakan GWO untuk membantu menentukan lebar kurva MF pada pengendali mikrogrid.",
  },
} as const;

type Paper = keyof typeof papers;

const topics = [
  { id: "fuzzy-manual", short: "Fuzzy manual", title: "Mengapa fuzzy manual belum tentu optimal?" },
  { id: "pilihan-gwo", short: "GWO, GA, dan PSO", title: "Mengapa memilih GWO?" },
  { id: "studi-gwo", short: "Studi GWO terdahulu", title: "Apakah GWO sudah digunakan pada WSN?" },
  { id: "mf-dan-aturan", short: "MF dan basis aturan", title: "Mengapa menyetel MF dan mempertahankan aturan?" },
  { id: "celah-literatur", short: "Celah literatur", title: "Celah apa yang ditemukan dari literatur?" },
  { id: "fitness-gwo", short: "Rancangan fitness", title: "Bagaimana fitness GWO ditentukan?" },
] as const;

const contents = [...topics, { id: "daftar-pustaka", short: "Daftar pustaka" }];

function Source({ paper }: { paper: Paper }) {
  return <a href={`#rujukan-${paper}`}>{papers[paper].author}</a>;
}

function Excerpt({
  paper,
  heading,
  passage,
}: {
  paper: Paper;
  heading?: string;
  passage?: { quote: string; meaning: string; page: string };
}) {
  const source = papers[paper];
  const { doi, title } = source;
  const { quote, meaning, page } = passage ?? papers[paper];
  return (
    <figure className={styles.excerpt}>
      {heading && <h4 className={styles.excerptHeading}>{heading}</h4>}
      <blockquote lang="en" cite={`https://doi.org/${doi}`}>“{quote}”</blockquote>
      <figcaption>
        <p className={styles.meaning}><strong>{heading ? "Terjemahan" : "Makna kutipan"}</strong> {meaning}</p>
        {heading && <cite className={styles.excerptTitle} lang="en">{title}</cite>}
        {heading && "publication" in source && <span>{source.publication}</span>}
        <div className={styles.excerptSource}>
          <a href={`https://doi.org/${doi}`}>{papers[paper].author}</a>
          <span>{page}</span>
        </div>
      </figcaption>
    </figure>
  );
}

function Evidence({ sources }: { sources: Paper[] }) {
  return (
    <div className={styles.evidence}>
      <h3>Kutipan asli dari paper</h3>
      {sources.map((paper) => <Excerpt key={paper} paper={paper} />)}
    </div>
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
        <ProjectBasisContents topics={contents} />

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
              berulang. Aturan manual juga perlu menimbang kriteria yang
              bersaing, misalnya apakah node berenergi tinggi tetapi jauh dari
              stasiun pangkalan lebih layak daripada node dengan energi sedang
              yang lebih dekat. Kurva awal di proyek ini berfungsi sebagai baseline.
              Kalibrasi mencari kurva dengan fitness simulasi yang lebih baik pada
              topologi dan bobot yang ditetapkan. Perbandingan pada kondisi
              yang setara menunjukkan apakah pencarian memberi manfaat.
            </p>
            <p>
              Zhang dkk. menjelaskan bahwa keberhasilan pengendali fuzzy banyak
              bergantung pada parameter yang ditentukan secara subjektif.
              Tremante dkk. menyoroti waktu dan kesulitan penyetelan melalui
              coba-coba. Herrera dkk. menegaskan bahwa MF dan aturan sama-sama
              memengaruhi performa. Dua sistem dengan input yang sama dapat
              menghasilkan keluaran dan performa berbeda apabila konfigurasi MF
              atau aturannya berbeda. Penentuan keduanya merupakan bagian penting
              dari desain sistem fuzzy.
            </p>
            <div className={styles.evidence}>
              <h3>Kutipan asli dari paper</h3>
              <Excerpt
                paper="zhang"
                heading="Parameter MF ditentukan secara subjektif"
                passage={{
                  quote: "The successful application of fuzzy control largely depends on some subjectively decided parameters, such as fuzzy membership functions.",
                  meaning: "Keberhasilan penerapan kontrol fuzzy sebagian besar bergantung pada beberapa parameter yang ditentukan secara subjektif, seperti fungsi keanggotaan fuzzy.",
                  page: "Abstrak, PDF hlm. 1 (hlm. 465 pada prosiding)",
                }}
              />
              <Excerpt
                paper="tremante"
                heading="Penyetelan coba-coba membutuhkan waktu"
              />
              <Excerpt
                paper="herrera"
                heading="Performa bergantung pada MF dan aturan"
                passage={{
                  quote: papers.herrera.quote,
                  meaning: "Performa fuzzy logic controller bergantung pada aturan kontrol dan fungsi keanggotaan yang digunakan.",
                  page: papers.herrera.page,
                }}
              />
              <Excerpt paper="hamzah" />
            </div>
            <p className={styles.evidenceContext}>
              Ketiga paper tentang pengendali fuzzy memberi landasan umum untuk
              menyetel parameter. Hamzah dkk. memberi contoh penetapan MF secara
              coba-coba pada WSN. Manfaat GWO dalam proyek ini tetap dinilai
              melalui perbandingan hasil simulasi pada kondisi yang setara.
            </p>
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
              metode pencarian. Laxman dkk. menunjukkan contoh pemakaian GWO
              untuk menyetel parameter MF pada pengendali panel surya.
              Untuk membandingkan GWO, GA, dan PSO di proyek ini, ketiganya
              perlu diuji dengan representasi MF, fitness, topologi, dan
              jumlah evaluasi kandidat yang sama. Pengulangan dengan seed
              optimizer berbeda membantu mengukur variasi hasil.
            </p>
            <Evidence sources={["mirjalili", "laxman", "giri"]} />
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
            <Evidence sources={["verma", "sennan"]} />
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
              ditetapkan, dan Zehra dkk. menyetel MF dengan GWO pada pengendali
              mikrogrid. Wang menunjukkan bahwa pilihan label keluaran aturan
              juga dapat dicari. Penyetelan MF mengubah kapan dan seberapa kuat
              sebuah aturan aktif. Penyetelan aturan dapat mengubah keputusan
              dari, misalnya, “kelayakan tinggi” menjadi “kelayakan sedang”.
            </p>
            <p>
              Untuk mengukur pengaruh masing-masing, rancangan lanjutan perlu
              empat konfigurasi: manual, MF saja, aturan saja, dan keduanya.
              Penyandingan dengan anggaran evaluasi yang sama membantu
              membedakan pengaruh kalibrasi dari biaya pencarian.
            </p>
            <Evidence sources={["herrera", "zhang", "zehra"]} />
            <Link className={styles.inlineAction} href="/membership">Bandingkan kurva MF awal dan GWO</Link>
          </Answer>

          <Answer topic={topics[4]}>
            <p>
              <Source paper="ghosh" /> menyetel MF dengan PSO, sedangkan{" "}
              <Source paper="wang" /> menyetel aturan dengan PSO. Keduanya
              menggunakan <em>Chance</em>, yaitu skor kelayakan CH, untuk
              menilai kandidat selama optimasi. Keduanya juga menilai kinerja
              jaringan dalam evaluasi. Skor Chance yang tinggi bisa menghasilkan
              umur jaringan atau PDR yang berbeda ketika beban dan jarak transmisi berubah.
            </p>
            <Evidence sources={["ghosh", "wang"]} />
            <div className={styles.finding}>
              <h3>Celah metodologis dari rujukan</h3>
              <p>
                Dalam rancangan WSN yang sama, bagaimana umur jaringan dan PDR
                berubah jika GWO menyetel MF dengan fitness berbasis hasil
                simulasi dibandingkan dengan fitness berbasis Chance?
                Kedua rujukan tadi memberi dasar untuk perbandingan ini.
              </p>
            </div>
            <dl className={styles.comparisons}>
              <div><dt>FUZZY manual</dt><dd>Baseline dengan MF awal. Sudah diuji.</dd></div>
              <div><dt>GWO dengan Chance</dt><dd>MF dikalibrasi dari skor kelayakan CH. Pembanding yang perlu diuji.</dd></div>
              <div><dt>GWO dengan simulasi</dt><dd>MF dikalibrasi dari metrik jaringan. Sudah diuji terhadap FUZZY manual.</dd></div>
            </dl>
            <p>
              Hasil saat ini mengukur dampak kalibrasi MF berbasis simulasi terhadap
              FUZZY manual pada 10 seed uji yang terpisah. Untuk mengisolasi
              pengaruh pilihan fitness, bandingkan kedua versi GWO dengan aturan,
              model jaringan, seed, dan anggaran evaluasi yang sama.
            </p>
            <p>
              Seed 42 pada eksperimen yang dikalibrasi dengan seed 42 termasuk
              data kalibrasi. Hasil pada seed itu menggambarkan kinerja dalam
              skenario tersebut. Bukti di luar kalibrasi berasal dari seed uji
              terpisah.
            </p>
            <Link className={styles.inlineAction} href="/validasi">Lihat hasil validasi model</Link>
          </Answer>

          <Answer topic={topics[5]}>
            <p>
              GWO menentukan cara memperbarui kandidat. Fitness menentukan
              kandidat seperti apa yang dinilai baik. Rumus fitness dapat
              dirancang sesuai tujuan penelitian, misalnya memaksimalkan HND,
              menggabungkan beberapa metrik, atau memaksimalkan HND dengan
              syarat PDR memenuhi ambang yang ditetapkan.
            </p>
            <ol className={styles.method} aria-label="Alur evaluasi fitness">
              <li><strong>Kandidat MF</strong><span>GWO mengusulkan 13 koordinat untuk kurva input.</span></li>
              <li><strong>Simulasi jaringan</strong><span>Jalankan kandidat pada topologi kalibrasi yang sama.</span></li>
              <li><strong>Skor fitness</strong><span>Rata-ratakan hasil antarseed dan gabungkan metrik yang telah dinormalisasi.</span></li>
            </ol>
            <p>
              Pada mode <em>lifetime</em> saat ini, setiap kandidat MF dinilai
              lewat simulasi pada topologi kalibrasi. Fitness menggabungkan lima
              ronde kematian node (FND, R10, HND, R90, LND), energi sisa tertinggi
              pada satu node saat simulasi berakhir, dan PDR. Ronde dinormalisasi
              dengan batas simulasi, energi dengan energi awal node, dan
              persentase PDR dibagi 100.
            </p>
            <p>
              Masing-masing dari tujuh komponen diberi bobot awal 0,30. Setelah
              dibagi jumlah bobot, bobot efektifnya masing-masing 1/7.
              Milestone yang belum teramati memakai nilai batas simulasi
              untuk menghitung fitness.
            </p>
            <Evidence sources={["rohilla"]} />
            <Link className={styles.inlineAction} href="/gwo">Lihat komponen fitness di Proses GWO</Link>
          </Answer>

          <section id="daftar-pustaka" className={styles.answer} aria-labelledby="judul-pustaka">
            <h2 id="judul-pustaka">Daftar pustaka</h2>
            <p>Nomor halaman pada kutipan mengikuti urutan di berkas PDF yang ditelaah.</p>
            <ol className={styles.references}>
              {Object.entries(papers).map(([id, paper]) => (
                <li key={id} id={`rujukan-${id}`}>
                  <strong>{paper.author}</strong>
                  <cite lang="en">{paper.title}</cite>
                  {"publication" in paper && <span>{paper.publication}</span>}
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

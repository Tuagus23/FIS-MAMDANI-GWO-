export default function Team() {
  return (
    <div className="space-y-5">
      {" "}
      <div className="team-intro panel">
        <div>
          <p className="team-eyebrow">Kelompok 3 · Pengantar Komputasi Lunak</p>
          <h2 className="panel-title">Empat peran, satu proyek</h2>
          <p className="panel-caption">
            Tim yang mengembangkan dashboard, sistem FIS Mamdani, dan optimasi
            GWO untuk analisis jaringan sensor nirkabel.
          </p>
        </div>
        <span className="team-count">4 anggota</span>
      </div>
      <div className="team-grid">
        <article className="member-card">
          <div className="member-photo-wrap">
            <img
              className="member-photo"
              src="/images/team/putu-agus-putra-darmawan.png"
              width="480"
              height="520"
              alt="Foto I Putu Agus Putra Darmawan"
              loading="lazy"
            />
            <span className="member-number">01</span>
          </div>
          <div className="member-card-body">
            <p className="member-nim">NIM 2308561040</p>
            <h3>I Putu Agus Putra Darmawan</h3>
            <span className="member-role">Pengembang web · logika GWO</span>
            <p className="member-contribution">
              Mengembangkan antarmuka dashboard dan logika optimasi Grey Wolf
              Optimizer.
            </p>
          </div>
        </article>
        <article className="member-card">
          <div className="member-photo-wrap">
            <img
              className="member-photo"
              src="/images/team/dewa-putu-adrian-paramarta.png"
              width="480"
              height="520"
              alt="Foto Dewa Putu Adrian Paramarta"
              loading="lazy"
            />
            <span className="member-number">02</span>
          </div>
          <div className="member-card-body">
            <p className="member-nim">NIM 2308561134</p>
            <h3>Dewa Putu Adrian Paramarta</h3>
            <span className="member-role">Sistem FIS Mamdani</span>
            <p className="member-contribution">
              Mengembangkan sistem inferensi fuzzy Mamdani untuk pemilihan
              cluster head.
            </p>
          </div>
        </article>
        <article className="member-card is-lead">
          <div className="member-photo-wrap">
            <img
              className="member-photo"
              src="/images/team/gede-rama-yasa-mahendra.png"
              width="480"
              height="520"
              alt="Foto I Gede Rama Yasa Mahendra"
              loading="lazy"
            />
            <span className="member-number">03</span>
          </div>
          <div className="member-card-body">
            <p className="member-nim">NIM 2308561016</p>
            <h3>I Gede Rama Yasa Mahendra</h3>
            <div className="member-role-row">
              <span className="member-role">Manajer proyek</span>
              <span className="member-lead-badge">Ketua kelompok</span>
            </div>
            <p className="member-contribution">
              Mengoordinasikan rencana kerja, pembagian tugas, dan penyelesaian
              proyek.
            </p>
          </div>
        </article>
        <article className="member-card">
          <div className="member-photo-wrap">
            <img
              className="member-photo"
              src="/images/team/aa-jaya-kesuma-wardana.png"
              width="480"
              height="520"
              alt="Foto A.A. Jaya Kesuma Wardana"
              loading="lazy"
            />
            <span className="member-number">04</span>
          </div>
          <div className="member-card-body">
            <p className="member-nim">NIM 2308561124</p>
            <h3>A.A. Jaya Kesuma Wardana</h3>
            <span className="member-role">Sistem FIS Mamdani</span>
            <p className="member-contribution">
              Mengembangkan dan mengintegrasikan aturan pada sistem FIS Mamdani.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

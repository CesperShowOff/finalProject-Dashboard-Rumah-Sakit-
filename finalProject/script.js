/**
 * script.js — Dashboard Rumah Sakit A
 * Fitur: CRUD Dokter, Toggle Status Aktif/Inaktif, Search & Filter,
 *        Statistik dinamis, Live Clock, Toast Notification.
 * Teknologi: Vanilla JavaScript (ES6+), tanpa library eksternal.
 */

"use strict";

/* ============================================================
   1. DATA STORE
   ============================================================ */

/**
 * Struktur data satu dokter:
 * {
 *   id          : string  — UUID unik
 *   name        : string  — Nama lengkap
 *   speciality  : string  — Spesialisasi
 *   schedule    : string  — Jadwal praktik
 *   status      : "active" | "inactive"
 *   consultations: number — Total konsultasi (default acak untuk demo)
 * }
 */

// Data awal (seed) untuk demo
/**
 * Struktur data satu dokter (diperbarui):
 * {
 *   id                   : string
 *   name                 : string
 *   speciality           : string
 *   schedule             : string
 *   status               : "active" | "inactive"
 *   consultationsDone    : number — pasien yang konsultasinya sudah selesai
 *   consultationsQueue   : number — pasien yang masih antri/menunggu
 * }
 */
const SEED_DOCTORS = [
  { id: uid(), name: "dr. Aditya Putra, Sp.JP",  speciality: "Kardiologi",     schedule: "Senin–Rabu, 08:00–14:00",     status: "active",   consultationsDone: 142, consultationsQueue: 8  },
  { id: uid(), name: "dr. Siti Rahayu, Sp.A",    speciality: "Anak",           schedule: "Selasa–Kamis, 09:00–15:00",   status: "active",   consultationsDone: 98,  consultationsQueue: 12 },
  { id: uid(), name: "dr. Budi Santoso, Sp.PD",  speciality: "Penyakit Dalam", schedule: "Senin–Jumat, 10:00–16:00",    status: "active",   consultationsDone: 211, consultationsQueue: 5  },
  { id: uid(), name: "dr. Rina Dewi, Sp.OG",     speciality: "Kebidanan",      schedule: "Rabu–Sabtu, 08:00–13:00",     status: "inactive", consultationsDone: 57,  consultationsQueue: 0  },
  { id: uid(), name: "dr. Hendro Wijaya, Sp.B",  speciality: "Bedah Umum",     schedule: "Senin–Kamis, 13:00–19:00",    status: "active",   consultationsDone: 76,  consultationsQueue: 3  },
  { id: uid(), name: "dr. Maya Lestari, Sp.M",   speciality: "Mata",           schedule: "Selasa & Jumat, 09:00–12:00", status: "inactive", consultationsDone: 33,  consultationsQueue: 0  },
];

// Muat dari localStorage jika ada, atau gunakan seed
let doctors = loadFromStorage();

/* ============================================================
   2. UTILITY FUNCTIONS
   ============================================================ */

/** Generate UUID sederhana (tidak bergantung crypto) */
function uid() {
  return "id-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Simpan array doctors ke localStorage */
function saveToStorage() {
  localStorage.setItem("rsa_doctors", JSON.stringify(doctors));
}

/** Muat doctors dari localStorage; jika kosong gunakan SEED.
 *  Jika data lama masih pakai field `consultations` (v1),
 *  migrasi otomatis ke model baru tanpa kehilangan data. */
function loadFromStorage() {
  const raw = localStorage.getItem("rsa_doctors");
  if (raw) {
    try {
      const data = JSON.parse(raw);
      // Migrasi v1 → v2: ganti field `consultations` menjadi `consultationsDone`
      return data.map(d => {
        if (d.consultationsDone === undefined) {
          const { consultations, ...rest } = d;
          return { ...rest, consultationsDone: consultations || 0, consultationsQueue: 0 };
        }
        return d;
      });
    } catch { /* jatuh ke seed */ }
  }
  return SEED_DOCTORS;
}

/* ============================================================
   3. DOM REFERENCES
   ============================================================ */
const clockEl          = document.getElementById("clock");
const dateDisplayEl    = document.getElementById("date-display");

const statTotal        = document.getElementById("stat-total");
const statActive       = document.getElementById("stat-active");
const statInactive     = document.getElementById("stat-inactive");
const statDone         = document.getElementById("stat-done");
const statTotalConsult = document.getElementById("stat-total-consult");

const tableBody        = document.getElementById("doctor-table-body");
const cardList         = document.getElementById("doctor-card-list");
const emptyState       = document.getElementById("empty-state");

const searchInput      = document.getElementById("search-input");
const filterStatus     = document.getElementById("filter-status");

const btnAddDoctor     = document.getElementById("btn-add-doctor");

// Modal form
const modalOverlay     = document.getElementById("modal-overlay");
const modalTitle       = document.getElementById("modal-title");
const doctorForm       = document.getElementById("doctor-form");
const formId           = document.getElementById("form-id");
const formName         = document.getElementById("form-name");
const formSpec         = document.getElementById("form-spec");
const formSchedule     = document.getElementById("form-schedule");
const formStatus       = document.getElementById("form-status");
const btnCloseModal    = document.getElementById("btn-close-modal");
const btnCancelForm    = document.getElementById("btn-cancel-form");

const errName          = document.getElementById("err-name");
const errSpec          = document.getElementById("err-spec");
const errSchedule      = document.getElementById("err-schedule");

// Modal delete
const modalDeleteOverlay  = document.getElementById("modal-delete-overlay");
const deleteConfirmText   = document.getElementById("delete-confirm-text");
const btnCancelDelete     = document.getElementById("btn-cancel-delete");
const btnConfirmDelete    = document.getElementById("btn-confirm-delete");

// Toast
const toastEl          = document.getElementById("toast");
const toastIcon        = document.getElementById("toast-icon");
const toastMessage     = document.getElementById("toast-message");

/* ============================================================
   4. STATE
   ============================================================ */
let pendingDeleteId = null;  // ID dokter yang akan dihapus
let toastTimer      = null;  // Timeout ID untuk auto-hide toast

/* ============================================================
   5. CLOCK & DATE
   ============================================================ */

/** Update jam dan tanggal setiap detik */
function updateClock() {
  const now = new Date();

  // Format jam HH:MM:SS
  const time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  clockEl.textContent = time;

  // Format tanggal panjang
  const date = now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  dateDisplayEl.textContent = date;
}

setInterval(updateClock, 1000);
updateClock(); // Panggil segera agar tidak ada delay 1 detik

/* ============================================================
   6. STATISTICS
   ============================================================ */

/** Hitung ulang dan tampilkan statistik summary */
function updateStats() {
  const total      = doctors.length;
  const active     = doctors.filter(d => d.status === "active").length;
  const inactive   = total - active;
  const totalDone  = doctors.reduce((sum, d) => sum + (d.consultationsDone  || 0), 0);
  const totalQueue = doctors.reduce((sum, d) => sum + (d.consultationsQueue || 0), 0);

  statTotal.textContent        = total;
  statActive.textContent       = active;
  statInactive.textContent     = inactive;
  statDone.textContent         = totalDone;
  statTotalConsult.textContent = totalDone + totalQueue; // total = selesai + antri
}

/* ============================================================
   7. RENDER — TABLE & CARDS
   ============================================================ */

/**
 * Kembalikan HTML badge status berdasarkan nilai status.
 * @param {"active"|"inactive"} status
 */
function renderBadge(status) {
  if (status === "active") {
    return `<span class="badge-active">Aktif</span>`;
  }
  return `<span class="badge-inactive">Inaktif</span>`;
}

/**
 * Kembalikan HTML sel konsultasi read-only: format "selesai / total".
 * Contoh: "4 / 14" — admin hanya melihat, tidak bisa mengubah.
 * @param {object} doctor
 */
function renderConsultCell(doctor) {
  const done  = doctor.consultationsDone  || 0;
  const queue = doctor.consultationsQueue || 0;
  const total = done + queue;

  return `
    <div class="inline-flex items-baseline gap-1 justify-center">
      <span class="badge-consult-done">${done}</span>
      <span class="text-slate-300 font-bold text-sm">/</span>
      <span class="text-slate-500 font-semibold text-sm">${total}</span>
    </div>`;
}

/**
 * Kembalikan HTML tombol aksi (toggle, edit, hapus) untuk satu dokter.
 * Dipakai di tabel maupun kartu mobile.
 * @param {object} doctor
 */
function renderActions(doctor) {
  const toggleLabel = doctor.status === "active" ? "Set Inaktif" : "Set Aktif";
  const toggleClass = doctor.status === "active"
    ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
    : "text-green-600 hover:text-green-700 hover:bg-green-50";

  return `
    <button onclick="toggleStatus('${doctor.id}')"
      title="${toggleLabel}"
      class="action-btn p-1.5 rounded-lg text-xs font-medium transition ${toggleClass}">
      <!-- Toggle icon -->
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m-4 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    </button>
    <button onclick="openEditModal('${doctor.id}')"
      title="Edit"
      class="action-btn p-1.5 rounded-lg text-xs font-medium transition text-primary-600 hover:text-primary-700 hover:bg-primary-50">
      <!-- Edit icon -->
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
    <button onclick="openDeleteModal('${doctor.id}')"
      title="Hapus"
      class="action-btn p-1.5 rounded-lg text-xs font-medium transition text-red-500 hover:text-red-600 hover:bg-red-50">
      <!-- Delete icon -->
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    </button>`;
}

/**
 * Filter doctors berdasarkan query pencarian dan status filter.
 * @returns {object[]} array dokter yang sudah terfilter
 */
function getFilteredDoctors() {
  const query  = searchInput.value.trim().toLowerCase();
  const status = filterStatus.value;

  return doctors.filter(d => {
    const matchSearch = !query ||
      d.name.toLowerCase().includes(query) ||
      d.speciality.toLowerCase().includes(query);

    const matchStatus = status === "all" || d.status === status;

    return matchSearch && matchStatus;
  });
}

/** Render tabel (desktop) dan kartu (mobile) berdasarkan data terfilter */
function renderList() {
  const filtered = getFilteredDoctors();

  // Tampilkan / sembunyikan empty state
  const isEmpty = filtered.length === 0;
  emptyState.classList.toggle("hidden", !isEmpty);
  emptyState.classList.toggle("flex", isEmpty);

  // ---- Render Tabel (desktop) ----
  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-400 text-sm">
          Tidak ada dokter yang sesuai filter.
        </td>
      </tr>`;
  } else {
    tableBody.innerHTML = filtered.map((doc, idx) => `
      <tr class="text-sm">
        <td class="px-6 py-4 text-slate-400 font-medium">${idx + 1}</td>
        <td class="px-6 py-4">
          <div class="font-semibold text-slate-800">${escapeHtml(doc.name)}</div>
        </td>
        <td class="px-6 py-4 text-slate-600">${escapeHtml(doc.speciality)}</td>
        <td class="px-6 py-4 text-slate-500 text-xs">${escapeHtml(doc.schedule)}</td>
        <td class="px-6 py-4 text-center">${renderConsultCell(doc)}</td>
        <td class="px-6 py-4 text-center">${renderBadge(doc.status)}</td>
        <td class="px-6 py-4">
          <div class="flex items-center justify-center gap-1">
            ${renderActions(doc)}
          </div>
        </td>
      </tr>`
    ).join("");
  }

  // ---- Render Kartu (mobile) ----
  if (filtered.length === 0) {
    cardList.innerHTML = `
      <div class="py-10 text-center text-slate-400 text-sm">
        Tidak ada dokter yang sesuai filter.
      </div>`;
  } else {
    cardList.innerHTML = filtered.map(doc => `
      <div class="doctor-card-item px-5 py-4 flex flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-semibold text-slate-800 text-sm">${escapeHtml(doc.name)}</p>
            <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(doc.speciality)}</p>
          </div>
          ${renderBadge(doc.status)}
        </div>
        <p class="text-xs text-slate-400">${escapeHtml(doc.schedule)}</p>
        <!-- Konsultasi read-only: selesai / total -->
        <div class="flex items-center gap-2">
          <span class="badge-done-sm">✓ ${doc.consultationsDone || 0} selesai</span>
          <span class="badge-queue-sm">⏳ ${doc.consultationsQueue || 0} antri</span>
          <span class="text-xs text-slate-400 font-medium">(${(doc.consultationsDone || 0) + (doc.consultationsQueue || 0)} total)</span>
        </div>
        <div class="flex items-center justify-end">
          <div class="flex gap-1">
            ${renderActions(doc)}
          </div>
        </div>
      </div>`
    ).join("");
  }
}

/**
 * Escape karakter HTML untuk mencegah XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================================
   8. CRUD OPERATIONS
   ============================================================ */

/**
 * CREATE — Tambah dokter baru ke array dan simpan ke storage.
 * @param {object} data - { name, speciality, schedule, status }
 */
function createDoctor(data) {
  const newDoctor = {
    id                  : uid(),
    name                : data.name.trim(),
    speciality          : data.speciality.trim(),
    schedule            : data.schedule.trim(),
    status              : data.status,
    consultationsDone   : 0,
    consultationsQueue  : 0,
  };
  doctors.push(newDoctor);
  saveToStorage();
  refresh();
  showToast("success", `Dokter "${newDoctor.name}" berhasil ditambahkan.`);
}

/**
 * UPDATE — Perbarui data dokter berdasarkan ID.
 * @param {string} id
 * @param {object} data - { name, speciality, schedule, status }
 */
function updateDoctor(id, data) {
  const idx = doctors.findIndex(d => d.id === id);
  if (idx === -1) return;

  doctors[idx] = {
    ...doctors[idx],
    name       : data.name.trim(),
    speciality : data.speciality.trim(),
    schedule   : data.schedule.trim(),
    status     : data.status,
  };
  saveToStorage();
  refresh();
  showToast("success", `Data dokter berhasil diperbarui.`);
}

/**
 * DELETE — Hapus dokter dari array berdasarkan ID.
 * @param {string} id
 */
function deleteDoctor(id) {
  const doc = doctors.find(d => d.id === id);
  doctors = doctors.filter(d => d.id !== id);
  saveToStorage();
  refresh();
  if (doc) showToast("error", `Dokter "${doc.name}" telah dihapus.`);
}

/**
 * TOGGLE STATUS — Beralih status aktif ↔ inaktif secara real-time.
 * Dipanggil langsung dari atribut onclick di HTML yang di-generate.
 * @param {string} id
 */
function toggleStatus(id) {
  const idx = doctors.findIndex(d => d.id === id);
  if (idx === -1) return;

  const prev = doctors[idx].status;
  doctors[idx].status = prev === "active" ? "inactive" : "active";
  saveToStorage();
  refresh();

  const label = doctors[idx].status === "active" ? "Aktif" : "Inaktif";
  showToast("info", `Status dokter diubah menjadi ${label}.`);
}

/* ============================================================
   9. MODAL — ADD / EDIT FORM
   ============================================================ */

/** Buka modal untuk menambah dokter baru */
function openAddModal() {
  modalTitle.textContent = "Tambah Dokter Baru";
  doctorForm.reset();
  formId.value = "";
  clearFormErrors();
  showModal(modalOverlay);
}

/**
 * Buka modal untuk mengedit dokter.
 * Dipanggil dari atribut onclick di HTML yang di-generate.
 * @param {string} id
 */
function openEditModal(id) {
  const doc = doctors.find(d => d.id === id);
  if (!doc) return;

  modalTitle.textContent    = "Edit Data Dokter";
  formId.value              = doc.id;
  formName.value            = doc.name;
  formSpec.value            = doc.speciality;
  formSchedule.value        = doc.schedule;
  formStatus.value          = doc.status;
  clearFormErrors();
  showModal(modalOverlay);
}

/** Tutup modal form */
function closeModal() {
  hideModal(modalOverlay);
}

/* ============================================================
   10. MODAL — CONFIRM DELETE
   ============================================================ */

/**
 * Buka modal konfirmasi hapus.
 * Dipanggil dari atribut onclick di HTML yang di-generate.
 * @param {string} id
 */
function openDeleteModal(id) {
  const doc = doctors.find(d => d.id === id);
  if (!doc) return;

  pendingDeleteId = id;
  deleteConfirmText.textContent = `Anda akan menghapus dokter "${doc.name}". Tindakan ini tidak dapat dibatalkan.`;
  showModal(modalDeleteOverlay);
}

/** Tutup modal konfirmasi hapus */
function closeDeleteModal() {
  pendingDeleteId = null;
  hideModal(modalDeleteOverlay);
}

/* ============================================================
   11. MODAL HELPERS
   ============================================================ */

/** Tampilkan overlay modal */
function showModal(overlay) {
  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
  // Cegah scroll body saat modal terbuka
  document.body.style.overflow = "hidden";
}

/** Sembunyikan overlay modal */
function hideModal(overlay) {
  overlay.classList.add("hidden");
  overlay.classList.remove("flex");
  document.body.style.overflow = "";
}

/* ============================================================
   12. FORM VALIDATION
   ============================================================ */

/**
 * Validasi form sebelum submit.
 * @returns {boolean} true jika valid
 */
function validateForm() {
  let valid = true;

  if (!formName.value.trim()) {
    errName.classList.remove("hidden");
    valid = false;
  }
  if (!formSpec.value.trim()) {
    errSpec.classList.remove("hidden");
    valid = false;
  }
  if (!formSchedule.value.trim()) {
    errSchedule.classList.remove("hidden");
    valid = false;
  }

  return valid;
}

/** Sembunyikan semua pesan error form */
function clearFormErrors() {
  errName.classList.add("hidden");
  errSpec.classList.add("hidden");
  errSchedule.classList.add("hidden");
}

/* ============================================================
   13. TOAST NOTIFICATION
   ============================================================ */

/**
 * Tampilkan toast notifikasi sementara.
 * @param {"success"|"error"|"info"} type
 * @param {string} message
 */
function showToast(type, message) {
  // Set ikon dan warna berdasarkan tipe
  const iconMap = {
    success: { symbol: "✓", color: "text-green-400" },
    error  : { symbol: "✕", color: "text-red-400"   },
    info   : { symbol: "ℹ", color: "text-blue-400"  },
  };
  const { symbol, color } = iconMap[type] || iconMap.info;

  toastIcon.textContent  = symbol;
  toastIcon.className    = color;
  toastMessage.textContent = message;

  // Tampilkan toast
  toastEl.classList.remove("hidden");
  toastEl.classList.add("flex");

  // Auto-hide setelah 3 detik
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add("hidden");
    toastEl.classList.remove("flex");
  }, 3000);
}

/* ============================================================
   14. REFRESH — Re-render semua bagian yang dinamis
   ============================================================ */

/** Refresh list dan statistik */
function refresh() {
  renderList();
  updateStats();
}

/* ============================================================
   15. EVENT LISTENERS
   ============================================================ */

// Tombol tambah dokter
btnAddDoctor.addEventListener("click", openAddModal);

// Tutup modal via tombol X dan Batal
btnCloseModal.addEventListener("click", closeModal);
btnCancelForm.addEventListener("click", closeModal);

// Tutup modal dengan klik di luar box
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Konfirmasi hapus
btnConfirmDelete.addEventListener("click", () => {
  if (pendingDeleteId) {
    deleteDoctor(pendingDeleteId);
    closeDeleteModal();
  }
});
btnCancelDelete.addEventListener("click", closeDeleteModal);
modalDeleteOverlay.addEventListener("click", (e) => {
  if (e.target === modalDeleteOverlay) closeDeleteModal();
});

// Submit form (Create / Update)
doctorForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearFormErrors();

  if (!validateForm()) return;

  const data = {
    name       : formName.value,
    speciality : formSpec.value,
    schedule   : formSchedule.value,
    status     : formStatus.value,
  };

  if (formId.value) {
    // Mode Edit
    updateDoctor(formId.value, data);
  } else {
    // Mode Tambah
    createDoctor(data);
  }
  closeModal();
});

// Hapus error real-time saat user mulai mengetik
formName.addEventListener("input", () => errName.classList.add("hidden"));
formSpec.addEventListener("input", () => errSpec.classList.add("hidden"));
formSchedule.addEventListener("input", () => errSchedule.classList.add("hidden"));

// Search & Filter secara real-time
searchInput.addEventListener("input", renderList);
filterStatus.addEventListener("change", renderList);

// Tutup modal dengan tombol Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeDeleteModal();
  }
});

/* ============================================================
   16. INIT — Jalankan saat halaman pertama kali dimuat
   ============================================================ */
refresh();

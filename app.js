    // =====================================================================
    // KONFIGURASI - GANTI URL INI dengan URL deployment Apps Script kamu
    // (Deploy > Manage deployments > Web app > pakai deployment yang SAMA
    // setiap update, supaya URL ini tidak berubah-ubah)
    // =====================================================================
    const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyduwMC2AoZwpIXU4XLM4rFBzOSWMVilusgEREu8FNyfwl7r62BcAwLei8wKJeQ6tU/exec";

    let appData = [];
    let isAdminLoggedIn = false;
    let adminToken = null; // token dikirim ke server untuk aksi hapus

    // ---------------------------------------------------------------------
    // HELPER: panggil Apps Script via fetch
    // POST dikirim sebagai text/plain supaya TIDAK memicu CORS preflight
    // (Apps Script tidak menyediakan handler doOptions)
    // ---------------------------------------------------------------------
    async function callAppsScriptPost(action, payload) {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload: payload || {} })
      });
      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' saat memanggil action "' + action + '"');
      }
      return res.json();
    }

    async function callAppsScriptGet(action, params) {
      const url = new URL(APPS_SCRIPT_URL);
      url.searchParams.set('action', action);
      if (params) {
        Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
      }
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' saat memanggil action "' + action + '"');
      }
      return res.json();
    }

    window.onload = function() {
      const now = new Date();
      const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
      const dateEl = document.getElementById('headerCurrentDate');
      if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', options);

      // Restore sesi admin dari localStorage kalau ada (browser ini saja)
      const savedLoggedIn = localStorage.getItem('isAdminLoggedIn');
      const savedToken = localStorage.getItem('adminToken');
      if (savedLoggedIn === '1') {
        adminToken = savedToken || ADMIN_PASSWORD;
        isAdminLoggedIn = true;
        updateAdminUI();
      }

      fetchDataFromAppsScript();
    };

    function getBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
      });
    }

    function openLoginModal() {
      const modal = document.getElementById('loginModal');
      modal.classList.remove('hidden');
      setTimeout(() => modal.classList.remove('opacity-0'), 10);
    }

    function closeLoginModal() {
      const modal = document.getElementById('loginModal');
      modal.classList.add('opacity-0');
      setTimeout(() => modal.classList.add('hidden'), 200);
    }

    // -----------------------------------------------------------------
    // LOGIN ADMIN
    // Login sekarang pakai username + password tetap (username: admin,
    // password: devop9b), dicek di sisi client, hanya untuk membuka akses
    // ke menu edit (aksi admin seperti Hapus di tabel "Cek Data").
    //
    // CATATAN KEAMANAN: karena file ini dihosting sebagai file statis
    // (frontend-only), siapa pun yang membuka app.js lewat "View Source"
    // bisa melihat username/password ini. Gerbang ini cukup untuk
    // menyembunyikan menu edit dari pengguna biasa, TAPI BUKAN pengaman
    // yang kuat. Aksi hapus tetap divalidasi ulang oleh server (Code.gs)
    // memakai ADMIN_TOKEN di Script Properties - kalau mau aksi hapus
    // tetap berfungsi, set ADMIN_TOKEN di Script Properties menjadi
    // sama dengan password ini ("devop9b"), atau ganti sendiri di bawah.
    // -----------------------------------------------------------------
    const ADMIN_USERNAME = 'admin';
    const ADMIN_PASSWORD = 'devop9b';

    async function handleLoginAdmin(e) {
      e.preventDefault();
      const usernameInput = document.getElementById('adminUsernameInput').value.trim();
      const passwordInput = document.getElementById('adminPasswordInput').value;
      const errorMsg = document.getElementById('loginErrorMsg');

      if (usernameInput !== ADMIN_USERNAME || passwordInput !== ADMIN_PASSWORD) {
        errorMsg.classList.remove('hidden');
        showToast('Gagal Login!', 'Username atau password salah.', 'error');
        return;
      }

      errorMsg.classList.add('hidden');

      // adminToken dipakai kalau ada aksi yang masih butuh otorisasi server (mis. Hapus)
      adminToken = passwordInput;
      isAdminLoggedIn = true;
      localStorage.setItem('isAdminLoggedIn', '1');
      localStorage.setItem('adminToken', adminToken);

      closeLoginModal();
      showToast('Login Berhasil!', 'Status Admin Aktif.', 'success');
      updateAdminUI();
      document.getElementById('adminUsernameInput').value = '';
      document.getElementById('adminPasswordInput').value = '';
    }

    function logoutAdmin() {
      isAdminLoggedIn = false;
      adminToken = null;
      localStorage.removeItem('isAdminLoggedIn');
      localStorage.removeItem('adminToken');
      updateAdminUI();
      showToast('Logout', 'Sesi Admin diakhiri.', 'info');
    }

    function updateAdminUI() {
      document.querySelectorAll('.js-open-login').forEach(btn => {
        isAdminLoggedIn ? btn.classList.add('hidden') : btn.classList.remove('hidden');
      });
      document.querySelectorAll('.js-admin-badge').forEach(badge => {
        isAdminLoggedIn ? badge.classList.remove('hidden') : badge.classList.add('hidden');
      });
      renderAllData();
    }

    async function deleteKendala(index) {
      if (!isAdminLoggedIn) {
        showToast('Ditolak!', 'Akses hapus hanya untuk Admin.', 'error');
        return;
      }

      const item = appData[index];
      if (!item) return;

      if (!confirm(`Apakah Anda yakin ingin menghapus kendala:\n"${item.judulKendala}"?`)) {
        return;
      }

      showToast('Memproses', 'Menghapus data...', 'info');

      try {
        const response = await callAppsScriptPost('deleteKendala', {
          token: adminToken,
          targetTitle: item.judulKendala || item.id
        });

        if (response && response.success) {
          showToast('Terhapus!', 'Kendala berhasil dihapus.', 'success');
          fetchDataFromAppsScript();
        } else {
          showToast('Gagal!', (response && response.message) ? response.message : 'Gagal menghapus.', 'error');
        }
      } catch (err) {
        showToast('Gagal!', err.message || 'Koneksi error.', 'error');
      }
    }

    // -----------------------------------------------------------------
    // EDIT KENDALA (khusus Admin)
    // -----------------------------------------------------------------
    function openEditModal(index) {
      if (!isAdminLoggedIn) {
        showToast('Ditolak!', 'Akses edit hanya untuk Admin.', 'error');
        return;
      }

      const item = appData[index];
      if (!item) return;

      document.getElementById('editKendalaId').value = item.id || '';
      document.getElementById('editJudulKendala').value = item.judulKendala || '';
      document.getElementById('editDetailKendala').value = item.detailKendala || '';
      document.getElementById('editSolusiTerkini').value = item.solusiTerkini || '';

      const modal = document.getElementById('editKendalaModal');
      modal.classList.remove('hidden');
      setTimeout(() => modal.classList.remove('opacity-0'), 10);
    }

    function closeEditModal() {
      const modal = document.getElementById('editKendalaModal');
      modal.classList.add('opacity-0');
      setTimeout(() => modal.classList.add('hidden'), 200);
    }

    async function submitEditKendala(e) {
      e.preventDefault();

      if (!isAdminLoggedIn) {
        showToast('Ditolak!', 'Akses edit hanya untuk Admin.', 'error');
        return;
      }

      const btn = document.getElementById('btnSubmitEditKendala');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> <span>Menyimpan...</span>';

      const payload = {
        token: adminToken,
        id: document.getElementById('editKendalaId').value,
        judulKendala: document.getElementById('editJudulKendala').value.trim(),
        detailKendala: document.getElementById('editDetailKendala').value.trim(),
        solusiTerkini: document.getElementById('editSolusiTerkini').value.trim()
      };

      try {
        const response = await callAppsScriptPost('editKendala', payload);
        btn.disabled = false;
        btn.innerHTML = originalText;

        if (response && response.success) {
          showToast('Sukses!', response.message || 'Kendala berhasil diperbarui.', 'success');
          closeEditModal();
          fetchDataFromAppsScript();
        } else {
          showToast('Gagal!', (response && response.message) ? response.message : 'Gagal memperbarui kendala.', 'error');
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        showToast('Gagal!', err.message || 'Koneksi error.', 'error');
      }
    }

    function switchTab(tabName) {
      document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
      });

      document.querySelectorAll('.nav-tab').forEach(el => {
        el.classList.remove('bg-gradient-to-r', 'from-app-primary', 'to-app-accentPurple', 'text-white', 'shadow-purple-glow', 'font-bold');
        el.classList.add('text-slate-600', 'font-semibold');
      });

      const targetSection = document.getElementById('content-' + tabName);
      if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
      }

      document.querySelectorAll('[data-tab="' + tabName + '"]').forEach(activeBtn => {
        activeBtn.classList.remove('text-slate-600', 'font-semibold');
        activeBtn.classList.add('bg-gradient-to-r', 'from-app-primary', 'to-app-accentPurple', 'text-white', 'shadow-purple-glow', 'font-bold');
      });

      if (tabName === 'dashboard') renderDashboard();
      else if (tabName === 'kendala') renderRecentKendala();
      else if (tabName === 'problem-solving') populateDropdownKendala();
      else if (tabName === 'cek-data') sortData();
    }

    function checkFileLimit(input) {
      var files = input.files;
      var maxSizeBytes = 1 * 1024 * 1024; // 1 MB

      if (files.length > 3) {
        alert("Maksimal hanya boleh memilih 3 foto!");
        input.value = "";
        return;
      }

      for (var i = 0; i < files.length; i++) {
        if (files[i].size > maxSizeBytes) {
          alert("Foto '" + files[i].name + "' melebihi batas 1 MB!");
          input.value = "";
          return;
        }
      }
    }

    async function submitKendala(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitKendala');
      if (!btn) return;
      const originalText = btn.innerHTML;

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> <span>Mengunggah Foto & Menyimpan...</span>';

      const fileInput = document.getElementById('fotoFileInput');
      let fotoFilesArray = [];

      if (fileInput && fileInput.files.length > 0) {
        const files = fileInput.files;

        if (files.length > 3) {
          showToast('Batas Terlampaui', 'Maksimal hanya boleh mengunggah 3 foto.', 'error');
          btn.disabled = false;
          btn.innerHTML = originalText;
          return;
        }

        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          if (file.size > 1 * 1024 * 1024) {
            showToast('File Terlalu Besar', `Foto "${file.name}" melebihi batas 1MB.`, 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
          }

          try {
            const base64Str = await getBase64(file);
            fotoFilesArray.push({ fileName: file.name, base64: base64Str });
          } catch (err) {
            showToast('Gagal', `Gagal memproses file foto: ${file.name}`, 'error');
            btn.disabled = false;
            btn.innerHTML = originalText;
            return;
          }
        }
      }

      const payload = {
        judulKendala: document.getElementById('judulKendala').value,
        detailKendala: document.getElementById('detailKendala').value,
        solusiTerkini: document.getElementById('solusiTerkini').value,
        fotoFiles: fotoFilesArray
      };

      try {
        const response = await callAppsScriptPost('saveKendala', payload);
        btn.disabled = false;
        btn.innerHTML = originalText;

        if (response && response.success) {
          showToast('Sukses', response.message, 'success');
          document.getElementById('formKendala').reset();
          fetchDataFromAppsScript();
        } else {
          showToast('Gagal', response ? response.message : 'Terjadi kesalahan sistem', 'error');
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        showToast('Error', err.toString(), 'error');
      }
    }

    function populateDropdownKendala() {
      const select = document.getElementById('selectJudulKendala');
      if (!select) return;
      select.innerHTML = '<option value="">-- Pilih Judul Kendala --</option>';

      const activeData = appData.filter(item => item && item.status !== 'Selesai');
      if (activeData.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "(Semua kendala telah Selesai / Belum ada data)";
        opt.disabled = true;
        select.appendChild(opt);
        return;
      }

      activeData.forEach(item => {
        if (item && item.judulKendala) {
          const opt = document.createElement('option');
          opt.value = item.judulKendala;
          opt.textContent = `${item.judulKendala} [${item.status || 'Baru'}]`;
          select.appendChild(opt);
        }
      });
    }

    function generateMultiplePhotoHtml(urlsString) {
      if (!urlsString || String(urlsString).trim() === '') {
        return '<span class="text-slate-300 italic">-</span>';
      }

      const urls = String(urlsString).split('\n').map(u => u.trim()).filter(u => u !== '');
      if (urls.length === 0) return '<span class="text-slate-300 italic">-</span>';

      return urls.map((url, index) => {
        return `<a href="${escapeHtml(url)}" target="_blank" class="inline-flex items-center space-x-1 px-2.5 py-1 bg-app-cardPurple hover:opacity-80 text-app-primary font-bold rounded-lg transition text-xs border border-indigo-200 my-0.5">
          <i class="fa-solid fa-image"></i>
          <span>Foto ${index + 1}</span>
        </a>`;
      }).join(' ');
    }

    function onSelectKendalaChanged() {
      const selectedTitle = document.getElementById('selectJudulKendala').value;
      const previewBox = document.getElementById('previewKendalaBox');
      const found = appData.find(item => item && item.judulKendala === selectedTitle);

      if (found) {
        document.getElementById('prevDetailKendala').textContent = found.detailKendala || '-';
        document.getElementById('prevSolusiTerkini').textContent = found.solusiTerkini || '-';

        const prevFotoBox = document.getElementById('prevFotoBox');
        const prevFotoContainer = document.getElementById('prevFotoContainer');

        if (found.fotoUrl && found.fotoUrl.trim() !== '') {
          prevFotoContainer.innerHTML = generateMultiplePhotoHtml(found.fotoUrl);
          prevFotoBox.classList.remove('hidden');
        } else {
          prevFotoBox.classList.add('hidden');
        }

        document.getElementById('rootCause').value = found.rootCause || '';
        document.getElementById('solusiPermanen').value = found.solusiPermanen || '';
        document.getElementById('picKendala').value = found.pic || '';
        document.getElementById('statusPenyelesaian').value = (found.status && found.status !== "Menunggu Problem Solving") ? found.status : "Dalam Proses";

        previewBox.classList.remove('hidden');
      } else {
        previewBox.classList.add('hidden');
      }
    }

    async function submitProblemSolving(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitPS');
      const selectedTitle = document.getElementById('selectJudulKendala').value;

      if (!selectedTitle) {
        showToast('Peringatan', 'Silakan pilih kendala.', 'error');
        return;
      }

      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> <span>Memperbarui...</span>';

      const payload = {
        judulKendala: selectedTitle,
        rootCause: document.getElementById('rootCause').value.trim(),
        solusiPermanen: document.getElementById('solusiPermanen').value.trim(),
        picKendala: document.getElementById('picKendala').value.trim(),
        statusPenyelesaian: document.getElementById('statusPenyelesaian').value
      };

      try {
        const response = await callAppsScriptPost('saveProblemSolving', payload);
        btn.disabled = false;
        btn.innerHTML = originalText;

        if (response && response.success) {
          showToast('Sukses!', response.message || 'Problem solving tersimpan.', 'success');
          document.getElementById('formProblemSolving').reset();
          document.getElementById('previewKendalaBox').classList.add('hidden');
          fetchDataFromAppsScript();
        } else {
          showToast('Error!', response.message || 'Gagal memperbarui.', 'error');
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        showToast('Gagal!', err.message || 'Koneksi error.', 'error');
      }
    }

    // Fungsi konversi berbagai format tanggal ke timestamp milidetik secara presisi
    function parseTimestamp(ts) {
      if (!ts) return 0;

      // Jika ts sudah berupa instance Object Date JavaScript
      if (ts instanceof Date) return ts.getTime();

      // Jika berupa timestamp angka murni
      if (typeof ts === 'number') return ts;

      const str = String(ts).trim();
      if (!str) return 0;

      // 1. Coba parsing bawaan JS dulu (mencakup ISO 8601 & Standard Formats)
      const parsedDirect = Date.parse(str);
      if (!isNaN(parsedDirect)) {
        return parsedDirect;
      }

      // 2. Custom Fallback Parsing untuk format "DD/MM/YYYY HH:mm:ss" atau "DD-MM-YYYY"
      try {
        const parts = str.split(/\s+/);
        if (parts.length >= 1) {
          const dateParts = parts[0].split(/[\/-]/);
          if (dateParts.length === 3) {
            let p1 = parseInt(dateParts[0], 10);
            let p2 = parseInt(dateParts[1], 10);
            let p3 = parseInt(dateParts[2], 10);

            let day, month, year;

            // Deteksi jika format YYYY-MM-DD atau DD/MM/YYYY
            if (p1 > 1000) {
              // Format: YYYY/MM/DD
              year = p1; month = p2 - 1; day = p3;
            } else {
              // Format: DD/MM/YYYY
              day = p1; month = p2 - 1; year = p3 < 100 ? p3 + 2000 : p3;
            }

            let hour = 0, min = 0, sec = 0;
            if (parts[1]) {
              const timeParts = parts[1].split(':');
              if (timeParts.length >= 1) hour = parseInt(timeParts[0], 10) || 0;
              if (timeParts.length >= 2) min = parseInt(timeParts[1], 10) || 0;
              if (timeParts.length >= 3) sec = parseInt(timeParts[2], 10) || 0;
            }

            const calculatedDate = new Date(year, month, day, hour, min, sec);
            return isNaN(calculatedDate.getTime()) ? 0 : calculatedDate.getTime();
          }
        }
      } catch (e) {
        return 0;
      }

      return 0;
    }

    function sortData() {
      const sortBy = document.getElementById('sortBy')?.value || 'NEWEST';
      appData.sort((a, b) => {
        const timeA = parseTimestamp(a.timestamp);
        const timeB = parseTimestamp(b.timestamp);
        return sortBy === 'NEWEST' ? timeB - timeA : timeA - timeB;
      });
      renderAllData();
    }

    function renderAllData() {
      const tbody = document.getElementById('tableBody');
      const mobileCardList = document.getElementById('mobileCardList');
      const emptyState = document.getElementById('emptyState');

      if(!tbody || !mobileCardList || !emptyState) return;

      tbody.innerHTML = '';
      mobileCardList.innerHTML = '';

      const colActions = document.querySelectorAll('.col-action');
      colActions.forEach(el => isAdminLoggedIn ? el.classList.remove('hidden') : el.classList.add('hidden'));

      if (!Array.isArray(appData)) appData = [];

      let totalCount = appData.length;
      let prosesCount = 0;
      let selesaiCount = 0;

      if (totalCount === 0) emptyState.classList.remove('hidden');
      else emptyState.classList.add('hidden');

      renderRecentKendala();
      renderDashboard();

      appData.forEach((item, index) => {
        if(!item) return;

        if (item.status === 'Selesai') selesaiCount++;
        else if (item.status === 'Dalam Proses') prosesCount++;

        let statusBadge = '';
        if (item.status === 'Selesai') {
          statusBadge = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800"><i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i> Selesai</span>';
        } else if (item.status === 'Dalam Proses') {
          statusBadge = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900"><i class="fa-solid fa-spinner mr-1 text-amber-600"></i> Proses</span>';
        } else {
          statusBadge = '<span class="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700"><i class="fa-solid fa-clock mr-1 text-slate-400"></i> Belum Solusi</span>';
        }

        let fotoHtml = generateMultiplePhotoHtml(item.fotoUrl);

        // Tabel Desktop
        const row = document.createElement('tr');
        row.className = 'hover:bg-indigo-50/40 transition border-b border-slate-100 table-row-item';
        row.dataset.title = (item.judulKendala || '').toLowerCase();
        row.dataset.detail = (item.detailKendala || '').toLowerCase();
        row.dataset.pic = (item.pic || '').toLowerCase();
        row.dataset.status = item.status || '';

        row.innerHTML = `
          <td class="py-3.5 px-4 text-slate-400 font-bold align-top">${index + 1}</td>
          <td class="py-3.5 px-4 text-slate-500 whitespace-nowrap align-top">${item.timestamp || '-'}</td>
          <td class="py-3.5 px-4 font-bold text-slate-900 align-top break-words">${escapeHtml(item.judulKendala)}</td>
          <td class="py-3.5 px-4 text-slate-600 align-top break-words">${escapeHtml(item.detailKendala)}</td>
          <td class="py-3.5 px-4 text-slate-600 align-top break-words">${escapeHtml(item.solusiTerkini)}</td>
          <td class="py-3.5 px-4 text-center align-top whitespace-nowrap">${fotoHtml}</td>
          <td class="py-3.5 px-4 text-slate-600 align-top break-words">
            ${item.solusiPermanen ? `<div class="font-bold text-emerald-700">${escapeHtml(item.solusiPermanen)}</div><div class="text-[10px] text-slate-400 mt-1">RC: ${escapeHtml(item.rootCause)}</div>` : '<span class="text-slate-300 italic">Belum diisi</span>'}
          </td>
          <td class="py-3.5 px-4 text-center font-semibold text-slate-700 align-top">${escapeHtml(item.pic || '-')}</td>
          <td class="py-3.5 px-4 text-center whitespace-nowrap align-top">${statusBadge}</td>
          ${isAdminLoggedIn ? `
            <td class="py-3.5 px-4 text-center align-top col-action whitespace-nowrap space-x-1.5">
              <button type="button" onclick="openEditModal(${index})" title="Edit" class="px-2.5 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-app-primary font-bold rounded-lg transition text-xs">
                <i class="fa-solid fa-pen mr-1"></i>Edit
              </button>
              <button type="button" onclick="deleteKendala(${index})" title="Hapus" class="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-600 font-bold rounded-lg transition text-xs">
                <i class="fa-solid fa-trash-can mr-1"></i>Hapus
              </button>
            </td>
          ` : ''}
        `;
        tbody.appendChild(row);

        // Mobile Cards
        const mCard = document.createElement('div');
        mCard.className = 'mobile-data-card bg-slate-50/80 border border-indigo-100/60 rounded-2xl p-4 space-y-3 transition shadow-sm';
        mCard.dataset.title = (item.judulKendala || '').toLowerCase();
        mCard.dataset.detail = (item.detailKendala || '').toLowerCase();
        mCard.dataset.pic = (item.pic || '').toLowerCase();
        mCard.dataset.status = item.status || '';

        mCard.innerHTML = `
          <div class="flex items-start justify-between gap-2 border-b border-slate-200/50 pb-2.5">
            <div class="font-bold text-sm text-slate-900 break-words">${escapeHtml(item.judulKendala)}</div>
            <div class="flex-shrink-0">${statusBadge}</div>
          </div>
          <div class="text-xs text-slate-600 space-y-2">
            <div><span class="font-bold text-slate-500">Detail:</span> ${escapeHtml(item.detailKendala)}</div>
            <div><span class="font-bold text-slate-500">Solusi Terkini:</span> ${escapeHtml(item.solusiTerkini)}</div>
            <div class="flex flex-wrap items-center gap-1 pt-1">
              <span class="font-bold text-slate-500">Foto Bukti:</span>
              <div class="flex flex-wrap gap-1">${fotoHtml}</div>
            </div>
            ${item.solusiPermanen ? `
              <div class="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div class="font-bold text-emerald-900 text-xs mb-0.5">Fix Solution:</div>
                <div class="text-emerald-800 text-xs">${escapeHtml(item.solusiPermanen)}</div>
                <div class="text-[10px] text-emerald-600 mt-1 font-medium">RC: ${escapeHtml(item.rootCause)}</div>
              </div>
            ` : ''}
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            <span><i class="fa-regular fa-clock mr-1"></i>${item.timestamp || '-'}</span>
            <div class="flex items-center space-x-3">
              <span class="font-bold text-slate-600"><i class="fa-solid fa-user-circle mr-1 text-app-primary"></i>${escapeHtml(item.pic || 'Tanpa PIC')}</span>
              ${isAdminLoggedIn ? `
                <button type="button" onclick="openEditModal(${index})" class="px-2 py-1 bg-indigo-100 text-app-primary font-bold rounded-lg text-[10px]">
                  <i class="fa-solid fa-pen mr-1"></i>Edit
                </button>
                <button type="button" onclick="deleteKendala(${index})" class="px-2 py-1 bg-rose-100 text-rose-600 font-bold rounded-lg text-[10px]">
                  <i class="fa-solid fa-trash-can mr-1"></i>Hapus
                </button>
              ` : ''}
            </div>
          </div>
        `;
        mobileCardList.appendChild(mCard);
      });

      filterDataTable();

      document.getElementById('statTotal').textContent = totalCount;
      document.getElementById('statProses').textContent = prosesCount;
      document.getElementById('statSelesai').textContent = selesaiCount;
    }

    function filterDataTable() {
      const query = (document.getElementById('searchInput').value || '').toLowerCase();
      const filterStatus = document.getElementById('filterStatus').value;

      document.querySelectorAll('.table-row-item').forEach(row => {
        const matchesText = row.dataset.title.includes(query) || row.dataset.detail.includes(query) || row.dataset.pic.includes(query);
        const matchesStatus = (filterStatus === 'ALL') || (row.dataset.status === filterStatus);
        row.style.display = (matchesText && matchesStatus) ? '' : 'none';
      });

      document.querySelectorAll('.mobile-data-card').forEach(card => {
        const matchesText = card.dataset.title.includes(query) || card.dataset.detail.includes(query) || card.dataset.pic.includes(query);
        const matchesStatus = (filterStatus === 'ALL') || (card.dataset.status === filterStatus);
        card.style.display = (matchesText && matchesStatus) ? '' : 'none';
      });
    }

    function renderRecentKendala() {
      const container = document.getElementById('recentKendalaList');
      if(!container) return;
      container.innerHTML = '';

      if(!Array.isArray(appData) || appData.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic col-span-2">Belum ada kendala.</p>';
        return;
      }

      const sortedRecent = [...appData].sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));
      const recentItems = sortedRecent.slice(0, 4);

      recentItems.forEach(item => {
        if(!item) return;
        const card = document.createElement('div');
        card.className = "p-4 rounded-2xl border border-indigo-100/60 bg-white shadow-soft-widget flex flex-col justify-between space-y-2";
        card.innerHTML = `
          <div>
            <div class="font-bold text-xs text-slate-900 line-clamp-1">${escapeHtml(item.judulKendala)}</div>
            <div class="text-[11px] text-slate-500 line-clamp-2 mt-0.5">${escapeHtml(item.detailKendala)}</div>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
            <span class="text-slate-400"><i class="fa-regular fa-clock mr-1"></i>${item.timestamp || ''}</span>
            <span class="font-bold px-2 py-0.5 rounded-full bg-app-cardPurple text-app-primary">${item.status || 'Baru'}</span>
          </div>
        `;
        container.appendChild(card);
      });
    }

    // =====================================================================
    // DASHBOARD (tab baru)
    // =====================================================================
    function statusPercent(status) {
      if (status === 'Selesai') return 100;
      if (status === 'Dalam Proses') return 55;
      return 12;
    }

    function timeAgoLabel(tsStr) {
      const t = parseTimestamp(tsStr);
      if (!t) return '-';
      const diffDay = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
      if (diffDay <= 0) return 'Hari ini';
      if (diffDay === 1) return '1 hari lalu';
      return diffDay + ' hari lalu';
    }

    function extractDateParts(tsStr) {
      const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      if (!tsStr) return { day: '-', month: '-' };
      const datePart = String(tsStr).split(' ')[0];
      const seg = datePart.split(/[\/-]/);
      if (seg.length < 3) return { day: '-', month: '-' };
      let p1 = parseInt(seg[0], 10), p2 = parseInt(seg[1], 10);
      let day, monthIdx;
      if (p1 > 1000) { day = parseInt(seg[2], 10); monthIdx = p2 - 1; }
      else { day = p1; monthIdx = p2 - 1; }
      return { day: isNaN(day) ? '-' : day, month: monthNames[((monthIdx % 12) + 12) % 12] || '-' };
    }

    function renderDashboard() {
      renderDashboardFeatureCards();
      renderDashboardActivity();
      renderDashboardTrend();
      renderDashboardPriority();
    }

    function renderDashboardFeatureCards() {
      const container = document.getElementById('dashboardFeatureCards');
      if (!container) return;

      if (!Array.isArray(appData) || appData.length === 0) {
        container.innerHTML = '<div class="sm:col-span-2 p-6 rounded-3xl border border-dashed border-indigo-200 text-center text-xs text-slate-400">Belum ada kendala. Mulai catat kendala pertama di menu Input Kendala.</div>';
        return;
      }

      const items = [...appData].sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp)).slice(0, 2);

      container.innerHTML = items.map((item, idx) => {
        const pct = statusPercent(item.status);
        const dateInfo = extractDateParts(item.timestamp);
        if (idx === 0) {
          return `
            <div class="rounded-3xl p-5 text-white bg-gradient-to-br from-app-primary to-app-primaryDark shadow-purple-glow flex flex-col justify-between min-h-[190px]">
              <div class="flex items-start justify-between mb-4">
                <div class="min-w-0">
                  <div class="text-[10px] uppercase tracking-wider text-white/70 font-bold mb-1">${escapeHtml(item.id || 'Kendala Baru')}</div>
                  <div class="font-extrabold text-base leading-snug line-clamp-2">${escapeHtml(item.judulKendala)}</div>
                </div>
                <button type="button" onclick="switchTab('cek-data')" class="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white/80 hover:bg-white/25 flex-shrink-0">
                  <i class="fa-solid fa-ellipsis"></i>
                </button>
              </div>
              <div class="flex items-center gap-4 text-[11px] text-white/80 mb-4">
                <span><i class="fa-regular fa-calendar mr-1"></i>${dateInfo.day} ${dateInfo.month}</span>
                <span><i class="fa-regular fa-clock mr-1"></i>${escapeHtml(item.status || 'Baru')}</span>
              </div>
              <div>
                <div class="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span>Progress</span><span>${pct}%</span>
                </div>
                <div class="h-1.5 rounded-full bg-white/25 overflow-hidden mb-4">
                  <div class="h-full bg-white rounded-full" style="width:${pct}%"></div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold bg-white/15 px-2.5 py-1 rounded-full truncate max-w-[60%]">${escapeHtml(item.pic || 'Belum ada PIC')}</span>
                  <span class="text-[10px] text-white/70 flex-shrink-0">${timeAgoLabel(item.timestamp)}</span>
                </div>
              </div>
            </div>`;
        }
        return `
          <div class="rounded-3xl p-5 bg-white border border-indigo-100/60 shadow-soft-widget flex flex-col justify-between min-h-[190px]">
            <div class="flex items-start justify-between mb-4">
              <div class="min-w-0">
                <div class="text-[10px] uppercase tracking-wider text-app-primary/70 font-bold mb-1">${escapeHtml(item.id || 'Kendala')}</div>
                <div class="font-extrabold text-base leading-snug text-slate-900 line-clamp-2">${escapeHtml(item.judulKendala)}</div>
              </div>
              <button type="button" onclick="switchTab('cek-data')" class="w-7 h-7 rounded-full bg-app-cardPurple flex items-center justify-center text-app-primary hover:opacity-80 flex-shrink-0">
                <i class="fa-solid fa-ellipsis"></i>
              </button>
            </div>
            <div class="flex items-center gap-4 text-[11px] text-slate-500 mb-4">
              <span><i class="fa-regular fa-calendar mr-1"></i>${dateInfo.day} ${dateInfo.month}</span>
              <span><i class="fa-regular fa-clock mr-1"></i>${escapeHtml(item.status || 'Baru')}</span>
            </div>
            <div>
              <div class="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
                <span>Progress</span><span class="text-app-primary">${pct}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-app-cardPurple overflow-hidden mb-4">
                <div class="h-full bg-app-primary rounded-full" style="width:${pct}%"></div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold bg-app-cardPurple text-app-primary px-2.5 py-1 rounded-full truncate max-w-[60%]">${escapeHtml(item.pic || 'Belum ada PIC')}</span>
                <span class="text-[10px] text-slate-400 flex-shrink-0">${timeAgoLabel(item.timestamp)}</span>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    function renderDashboardActivity() {
      const container = document.getElementById('dashboardActivityList');
      if (!container) return;

      if (!Array.isArray(appData) || appData.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic py-4">Belum ada aktivitas kendala.</p>';
        return;
      }

      const items = [...appData].sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp)).slice(0, 6);

      container.innerHTML = items.map(item => {
        const dateInfo = extractDateParts(item.timestamp);
        let barColor = 'bg-slate-200', chip = 'bg-slate-100 text-slate-600';
        if (item.status === 'Selesai') { barColor = 'bg-emerald-400'; chip = 'bg-emerald-100 text-emerald-700'; }
        else if (item.status === 'Dalam Proses') { barColor = 'bg-amber-400'; chip = 'bg-amber-100 text-amber-800'; }
        else { barColor = 'bg-app-primary'; chip = 'bg-app-cardPurple text-app-primary'; }

        return `
          <div class="flex items-center gap-3 py-3">
            <div class="w-1.5 self-stretch rounded-full ${barColor} flex-shrink-0"></div>
            <div class="w-11 text-center flex-shrink-0">
              <div class="text-[10px] text-slate-400 font-bold uppercase">${dateInfo.month}</div>
              <div class="text-base font-extrabold text-slate-800">${dateInfo.day}</div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-slate-900 truncate">${escapeHtml(item.judulKendala)}</div>
              <div class="text-[11px] text-slate-400 truncate">${escapeHtml(item.detailKendala)}</div>
            </div>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${chip}">${escapeHtml(item.status || 'Baru')}</span>
            <button type="button" onclick="switchTab('cek-data')" class="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
              <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>`;
      }).join('');
    }

    function renderDashboardTrend() {
      const chartEl = document.getElementById('dashboardTrendChart');
      const labelsEl = document.getElementById('dashboardTrendLabels');
      const totalEl = document.getElementById('dashboardTrendTotal');
      if (!chartEl || !labelsEl) return;

      const dayNamesId = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
      const days = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        days.push(d);
      }

      const counts = days.map(d => {
        return (Array.isArray(appData) ? appData : []).filter(item => {
          if (!item) return false;
          const t = parseTimestamp(item.timestamp);
          if (!t) return false;
          const id = new Date(t);
          return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth() && id.getDate() === d.getDate();
        }).length;
      });

      const max = Math.max(...counts, 1);
      const total = counts.reduce((a, b) => a + b, 0);

      chartEl.innerHTML = counts.map(c => `
        <div class="flex-1 flex flex-col items-center justify-end h-full">
          <div class="w-full max-w-[18px] rounded-full bg-gradient-to-t from-app-primary to-app-accentPurple" style="height:${Math.max((c / max) * 100, 6)}%"></div>
        </div>`).join('');

      labelsEl.innerHTML = days.map(d => `<span>${dayNamesId[d.getDay()]}</span>`).join('');

      if (totalEl) totalEl.textContent = total + ' kendala';
    }

    function renderDashboardPriority() {
      const container = document.getElementById('dashboardPriorityList');
      if (!container) return;

      const open = (Array.isArray(appData) ? appData : []).filter(item => item && item.status !== 'Selesai');
      open.sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
      const top = open.slice(0, 4);

      if (top.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic">Semua kendala sudah selesai 🎉</p>';
        return;
      }

      container.innerHTML = top.map(item => {
        const words = (item.judulKendala || 'K').trim().split(/\s+/).slice(0, 2);
        const initials = words.map(w => w[0] || '').join('').toUpperCase() || 'K';
        const chip = item.status === 'Dalam Proses' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
        return `
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-app-cardPurple text-app-primary font-bold flex items-center justify-center text-xs flex-shrink-0">${escapeHtml(initials)}</div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-slate-900 truncate">${escapeHtml(item.judulKendala)}</div>
              <div class="text-[10px] text-slate-400 truncate">${escapeHtml(item.pic || 'Belum ada PIC')} &bull; ${timeAgoLabel(item.timestamp)}</div>
            </div>
            <span class="text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${chip}">${escapeHtml(item.status || 'Baru')}</span>
          </div>`;
      }).join('');
    }

    function handleGlobalSearchKey(e, isMobile) {
      if (e.key !== 'Enter') return;
      const val = (isMobile ? document.getElementById('globalSearchInputMobile') : document.getElementById('globalSearchInput')).value;
      switchTab('cek-data');
      const searchInput = document.getElementById('searchInput');
      searchInput.value = val;
      filterDataTable();
    }

    function showNotificationSummary() {
      const open = (Array.isArray(appData) ? appData : []).filter(item => item && item.status !== 'Selesai');
      if (open.length === 0) {
        showToast('Notifikasi', 'Semua kendala sudah selesai. Kerja bagus!', 'success');
      } else {
        showToast('Notifikasi', `Ada ${open.length} kendala yang masih perlu ditangani.`, 'info');
      }
    }

    function refreshData() {
      fetchDataFromAppsScript();
    }

    async function fetchDataFromAppsScript() {
      showToast('Loading', 'Memuat data...', 'info');
      try {
        const response = await callAppsScriptGet('getAllData');
        if (response && response.success) {
          appData = response.data || [];
          sortData(); // Memastikan otomatis diurutkan Terbaru -> Lama secara default
          populateDropdownKendala();
          showToast('Sukses', 'Data dimuat.', 'success');

          const open = appData.filter(item => item && item.status !== 'Selesai');
          const notifDot = document.getElementById('notifDot');
          if (notifDot) open.length > 0 ? notifDot.classList.remove('hidden') : notifDot.classList.add('hidden');
        } else {
          showToast('Gagal', (response && response.message) ? response.message : 'Gagal memuat data.', 'error');
        }
      } catch (err) {
        showToast('Gagal', 'Gagal memuat data: ' + err.message, 'error');
      }
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function showToast(title, message, type = 'info') {
      const toast = document.getElementById('toast');
      const toastMessage = document.getElementById('toastMessage');
      const toastIcon = document.getElementById('toastIcon');

      if (!toast || !toastMessage || !toastIcon) return;

      toastMessage.innerHTML = `<span class="font-bold">${title}</span> ${message}`;

      if (type === 'success') {
        toastIcon.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-400"></i>';
      } else if (type === 'error') {
        toastIcon.innerHTML = '<i class="fa-solid fa-circle-xmark text-rose-400"></i>';
      } else {
        toastIcon.innerHTML = '<i class="fa-solid fa-circle-info text-sky-400"></i>';
      }

      toast.classList.remove('-translate-y-20', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');

      setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('-translate-y-20', 'opacity-0');
      }, 3000);
    }

    function downloadPDF() {
      if (!appData || appData.length === 0) {
        showToast('Peringatan', 'Tidak ada data untuk diunduh.', 'error');
        return;
      }

      showToast('Memproses', 'Membuat berkas PDF...', 'info');

      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text("Laporan Tracker Kendala & Problem Solving", 14, 15);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("Dicetak pada: " + new Date().toLocaleString("id-ID"), 14, 21);

        const tableHeaders = [["No", "ID", "Waktu", "Judul Kendala", "Detail Kendala", "Solusi Terkini", "Foto URL", "Fix Solution / RC", "PIC", "Status"]];

        const tableRows = appData.map((item, index) => {
          let fixSolText = '-';
          if (item.solusiPermanen) {
            fixSolText = item.solusiPermanen + (item.rootCause ? ` (RC: ${item.rootCause})` : '');
          }

          return [
            index + 1,
            item.id || '-',
            item.timestamp || '-',
            item.judulKendala || '-',
            item.detailKendala || '-',
            item.solusiTerkini || '-',
            item.fotoUrl || '-',
            fixSolText,
            item.pic || '-',
            item.status || 'Belum Solusi'
          ];
        });

        doc.autoTable({
          head: tableHeaders,
          body: tableRows,
          startY: 26,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
          headStyles: { fillColor: [255, 111, 72], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { cellWidth: 16 },
            2: { cellWidth: 22 },
            3: { cellWidth: 35, fontStyle: 'bold' },
            4: { cellWidth: 40 },
            5: { cellWidth: 35 },
            6: { cellWidth: 30 },
            7: { cellWidth: 40 },
            8: { halign: 'center', cellWidth: 18 },
            9: { halign: 'center', cellWidth: 22 }
          }
        });

        const fileName = `Laporan_Kendala_${new Date().toISOString().slice(0,10)}.pdf`;
        doc.save(fileName);
        showToast('Sukses!', 'Berkas PDF diunduh.', 'success');

      } catch (err) {
        showToast('Gagal!', 'Terjadi kesalahan saat membuat PDF.', 'error');
      }
    }

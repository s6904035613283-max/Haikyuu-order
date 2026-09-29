'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const C = {
  bg: '#f4f7f6',
  ink: '#1c2b2a',
  muted: '#5b6b69',
  line: '#c9d5d2',
  primary: '#0f766e',
  primaryText: '#ffffff',
  warnBg: '#fff1e6',
  warnLine: '#e4572e',
  warnInk: '#7a1f0a',
  danger: '#c62828',
  okBg: '#e6f4ea',
  okInk: '#14532d',
};

const styles = {
  page: {
    minHeight: '100vh',
    background: C.bg,
    color: C.ink,
    padding: '24px 16px 48px',
    display: 'flex',
    justifyContent: 'center',
  },
  wrap: { width: '100%', maxWidth: 520, display: 'grid', gap: 20, alignContent: 'start' },
  h1: { fontSize: 36, margin: 0 },
  card: {
    background: '#fff',
    border: `2px solid ${C.line}`,
    borderRadius: 16,
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  label: { display: 'grid', gap: 6, fontSize: 22, fontWeight: 600 },
  input: {
    fontSize: 32,
    padding: '12px 14px',
    borderRadius: 12,
    border: `2px solid ${C.line}`,
    width: '100%',
    boxSizing: 'border-box',
    color: C.ink,
  },
  btn: {
    fontSize: 26,
    fontWeight: 700,
    padding: '16px 20px',
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    background: C.primary,
    color: C.primaryText,
    width: '100%',
  },
  btnGhost: {
    fontSize: 24,
    fontWeight: 600,
    padding: '14px 18px',
    borderRadius: 14,
    border: `2px solid ${C.line}`,
    cursor: 'pointer',
    background: '#fff',
    color: C.ink,
    width: '100%',
  },
  btnDanger: {
    fontSize: 24,
    fontWeight: 700,
    padding: '14px 18px',
    borderRadius: 14,
    border: 'none',
    cursor: 'pointer',
    background: C.danger,
    color: '#fff',
    width: '100%',
  },
  warn: {
    background: C.warnBg,
    border: `3px solid ${C.warnLine}`,
    color: C.warnInk,
    borderRadius: 16,
    padding: 20,
    display: 'grid',
    gap: 14,
  },
  error: {
    background: '#fdecea',
    border: `2px solid ${C.danger}`,
    color: '#7f1d1d',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 20,
  },
  ok: {
    background: C.okBg,
    color: C.okInk,
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 20,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 50,
  },
  dialog: {
    background: '#fff',
    border: `4px solid ${C.warnLine}`,
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 460,
    display: 'grid',
    gap: 16,
  },
};

function toCount(value) {
  const n = Number(value === '' ? 0 : value);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

export default function GenerateQrPage() {
  const [table, setTable] = useState('');
  const [adult, setAdult] = useState('');
  const [child, setChild] = useState('0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [existing, setExisting] = useState(null); // session เก่าที่ยังเปิดค้าง
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(0);
  const [closing, setClosing] = useState(false);

  const [result, setResult] = useState(null); // { url, table, adult, child }
  const [copied, setCopied] = useState(false);

  // ปิดกล่องยืนยันด้วยปุ่ม Esc
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !closing) setConfirmOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen, closing]);

  function onTableChange(v) {
    setTable(v);
    // เปลี่ยนเลขโต๊ะแล้ว กล่องเตือนของโต๊ะเดิมไม่เกี่ยวข้องอีก
    if (existing) setExisting(null);
    setNotice('');
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setError('');
    setNotice('');

    const tableNumber = Number(table);
    const adultCount = toCount(adult);
    const childCount = toCount(child);

    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      setError('กรุณากรอกเลขโต๊ะเป็นตัวเลข');
      return;
    }
    if (Number.isNaN(adultCount) || Number.isNaN(childCount)) {
      setError('จำนวนผู้ใหญ่และเด็กต้องเป็นตัวเลข 0 ขึ้นไป');
      return;
    }
    if (adultCount + childCount < 1) {
      setError('กรุณากรอกจำนวนลูกค้าอย่างน้อย 1 คน');
      return;
    }

    setLoading(true);
    try {
      const { data: open, error: checkErr } = await supabase
        .from('sessions')
        .select('id, adult_count, child_count, created_at')
        .eq('table_number', tableNumber)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (checkErr) throw checkErr;

      if (open) {
        setExisting(open);
        return;
      }

      const { error: insertErr } = await supabase
        .from('sessions')
        .insert({
          table_number: tableNumber,
          adult_count: adultCount,
          child_count: childCount,
          status: 'open',
        });
      if (insertErr) throw insertErr;

      setResult({
        url: `${window.location.origin}/order/${tableNumber}`,
        table: tableNumber,
        adult: adultCount,
        child: childCount,
      });
    } catch (err) {
      setError(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'}`);
    } finally {
      setLoading(false);
    }
  }

  function openConfirm() {
    const started = new Date(existing.created_at).getTime();
    setMinutesOpen(Math.max(0, Math.floor((Date.now() - started) / 60000)));
    setConfirmOpen(true);
  }

  async function handleConfirmClose() {
    setClosing(true);
    setError('');
    try {
      // เช็คซ้ำว่ายัง open อยู่ เพื่อกันการกดซ้ำซ้อน
      const { error: updateErr } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existing.id)
        .eq('status', 'open');
      if (updateErr) throw updateErr;

      setConfirmOpen(false);
      setExisting(null);
      setNotice('ปิดโต๊ะเดิมแล้ว กดปุ่ม "เปิดโต๊ะ" อีกครั้งเพื่อเปิดโต๊ะใหม่');
    } catch (err) {
      setConfirmOpen(false);
      setError(`ปิดโต๊ะเดิมไม่สำเร็จ: ${err.message || 'กรุณาลองใหม่'}`);
    } finally {
      setClosing(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(result.url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = result.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetAll() {
    setResult(null);
    setExisting(null);
    setConfirmOpen(false);
    setError('');
    setNotice('');
    setTable('');
    setAdult('');
    setChild('0');
  }

  // ---------- หน้าผลลัพธ์ QR ----------
  if (result) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.url)}`;
    return (
      <main style={styles.page}>
        <div style={styles.wrap}>
          <h1 style={styles.h1}>เปิดโต๊ะสำเร็จ</h1>
          <section style={{ ...styles.card, justifyItems: 'center', textAlign: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt={`QR Code โต๊ะ ${result.table}`}
              width={300}
              height={300}
              style={{ maxWidth: '100%', height: 'auto' }}
            />
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              โต๊ะ {result.table} · ผู้ใหญ่ {result.adult} · เด็ก {result.child}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 20, wordBreak: 'break-all' }}>{result.url}</span>
              <button
                type="button"
                onClick={copyLink}
                style={{ ...styles.btnGhost, width: 'auto', fontSize: 18, padding: '8px 14px' }}
              >
                {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
              </button>
            </div>
          </section>
          <button type="button" onClick={resetAll} style={styles.btn}>
            เปิดโต๊ะใหม่
          </button>
        </div>
      </main>
    );
  }

  // ---------- ฟอร์มเปิดโต๊ะ ----------
  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <h1 style={styles.h1}>เปิดโต๊ะ</h1>

        {existing && (
          <section style={styles.warn} role="alert">
            <div style={{ fontSize: 26, fontWeight: 700 }}>
              โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
            </div>
            <button type="button" onClick={openConfirm} style={styles.btnDanger}>
              ปิดออเดอร์เดิม
            </button>
          </section>
        )}

        {notice && <div style={styles.ok}>{notice}</div>}
        {error && (
          <div style={styles.error} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleOpenTable} style={styles.card}>
          <label style={styles.label}>
            เลขโต๊ะ
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={table}
              onChange={(e) => onTableChange(e.target.value)}
              style={styles.input}
              required
            />
          </label>
          <label style={styles.label}>
            จำนวนผู้ใหญ่
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={adult}
              onChange={(e) => setAdult(e.target.value)}
              style={styles.input}
            />
          </label>
          <label style={styles.label}>
            จำนวนเด็ก
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={child}
              onChange={(e) => setChild(e.target.value)}
              style={styles.input}
            />
          </label>
          <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'กำลังตรวจสอบ...' : 'เปิดโต๊ะ'}
          </button>
        </form>
      </div>

      {confirmOpen && existing && (
        <div style={styles.overlay}>
          <div style={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div id="confirm-title" style={{ fontSize: 28, fontWeight: 800, color: C.warnInk }}>
              ยืนยันปิดโต๊ะเดิม?
            </div>
            <div style={{ fontSize: 24, display: 'grid', gap: 6 }}>
              <div>โต๊ะ {Number(table)}</div>
              <div>
                ผู้ใหญ่ {existing.adult_count} · เด็ก {existing.child_count}
              </div>
              <div>เปิดมาแล้ว {minutesOpen} นาที</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button type="button" onClick={handleConfirmClose} disabled={closing} style={{ ...styles.btnDanger, opacity: closing ? 0.6 : 1 }}>
                {closing ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={closing} style={styles.btnGhost}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

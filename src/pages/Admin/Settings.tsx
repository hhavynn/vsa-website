import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/common/PageTitle';
import { supabase } from '../../lib/supabase';
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_ID } from '../../data/siteSettings';
import { useSiteSettings } from '../../context/SiteSettingsContext';

const inputCls = 'mt-1 block w-full rounded border px-3 py-2 text-sm focus:outline-none font-sans';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-[0.07em]';

export default function AdminSettings() {
  const { settings, refresh } = useSiteSettings();
  const [logoUrl, setLogoUrl] = useState('');
  const [logoAlt, setLogoAlt] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLogoUrl(settings.logoUrl);
    setLogoAlt(settings.logoAlt || DEFAULT_SITE_SETTINGS.logoAlt);
  }, [settings]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'] },
    maxFiles: 1,
  });

  async function uploadLogo(file: File): Promise<string> {
    const ext = file.name.split('.').pop();
    const fileName = `logo-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('site_assets').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('site_assets').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      const finalLogoUrl = logoFile ? await uploadLogo(logoFile) : logoUrl.trim();
      const { error } = await supabase.from('site_settings').upsert(
        {
          id: SITE_SETTINGS_ID,
          logo_url: finalLogoUrl || null,
          logo_alt: logoAlt.trim() || DEFAULT_SITE_SETTINGS.logoAlt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (error) throw error;
      setLogoUrl(finalLogoUrl);
      setLogoFile(null);
      setLogoPreview('');
      await refresh();
      toast.success('Settings saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  }

  const previewSrc = logoPreview || logoUrl;
  const fieldStyle = {
    borderColor: 'var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  };

  return (
    <>
      <PageTitle title="Admin Settings" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>Site Settings</h1>
        <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>
          Manage the logo and branding displayed across the website.
        </p>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.6fr)] gap-6">
          <form
            onSubmit={handleSubmit}
            className="border rounded p-6 space-y-5"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          >
            <h2 className="font-sans font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Logo</h2>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Logo URL</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => { setLogoUrl(e.target.value); setLogoFile(null); setLogoPreview(''); }}
                className={inputCls}
                style={fieldStyle}
                placeholder="https://..."
              />
              <p className="mt-1 font-sans text-[11px]" style={{ color: 'var(--color-text3)' }}>
                Or upload a file below. Square images (PNG/WebP) work best — the logo is displayed as a circle.
              </p>
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Upload Logo</label>
              <div
                {...getRootProps()}
                className="mt-1 flex min-h-36 flex-col items-center justify-center border border-dashed rounded p-6 cursor-pointer transition-colors"
                style={{
                  borderColor: isDragActive ? 'var(--color-brand)' : 'var(--color-border)',
                  background: isDragActive ? 'var(--color-surface2)' : 'transparent',
                }}
              >
                <input {...getInputProps()} />
                {previewSrc ? (
                  <img src={previewSrc} alt="Logo preview" className="h-24 w-24 rounded-full object-cover" style={{ border: '1px solid var(--color-border)' }} />
                ) : (
                  <p className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>
                    Drag and drop or click to upload
                  </p>
                )}
              </div>
              {previewSrc && (
                <button
                  type="button"
                  className="mt-1.5 font-sans text-xs text-red-500 hover:text-red-400"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => { setLogoUrl(''); setLogoFile(null); setLogoPreview(''); }}
                >
                  Remove logo
                </button>
              )}
            </div>

            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Alt Text</label>
              <input
                type="text"
                value={logoAlt}
                onChange={(e) => setLogoAlt(e.target.value)}
                className={inputCls}
                style={fieldStyle}
                placeholder="VSA at UC San Diego"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="font-sans font-medium px-5 py-2 rounded text-sm transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none', cursor: loading ? 'default' : 'pointer' }}
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>

          <aside className="border rounded overflow-hidden h-fit" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="font-sans font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Preview</h2>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--color-text3)' }}>
                  In navigation
                </p>
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
                >
                  {previewSrc ? (
                    <img src={previewSrc} alt={logoAlt} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold font-sans tracking-wide"
                      style={{ background: 'var(--color-brand)', color: '#fff' }}
                    >
                      VSA
                    </span>
                  )}
                  <span className="font-serif text-[17px] tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                    <em className="not-italic italic" style={{ color: 'var(--color-brand)' }}>VSA</em> at UCSD
                  </span>
                </div>
              </div>

              <div>
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--color-text3)' }}>
                  In footer
                </p>
                <div
                  className="flex flex-col items-center gap-2 py-4 rounded border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
                >
                  {previewSrc ? (
                    <img src={previewSrc} alt={logoAlt} className="h-14 w-14 rounded-full object-cover" style={{ border: '1px solid var(--color-border)' }} />
                  ) : (
                    <div
                      className="h-14 w-14 rounded-full flex items-center justify-center font-sans text-sm font-semibold"
                      style={{ background: 'var(--color-brand)', color: '#fff' }}
                    >
                      VSA
                    </div>
                  )}
                  <p className="font-serif text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>
                    <em className="italic" style={{ color: 'var(--color-brand)' }}>VSA</em> at UCSD
                  </p>
                  <p className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Vietnamese Student Association · Est. 1977</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

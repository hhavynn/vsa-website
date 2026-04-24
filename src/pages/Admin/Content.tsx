import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { PageTitle } from '../../components/common/PageTitle';
import { supabase } from '../../lib/supabase';
import {
  DEFAULT_PRESIDENTS_CONTENT,
  PRESIDENTS_CONTENT_ID,
  PresidentsContent,
  splitPresidentsMessage,
} from '../../data/presidentsContent';

const inputCls = 'mt-1 block w-full rounded border px-3 py-2 text-sm focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20 font-sans';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-[0.07em]';

export default function AdminContent() {
  const [form, setForm] = useState<PresidentsContent>(DEFAULT_PRESIDENTS_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadContent() {
      try {
        const result = await supabase
          .from('homepage_content')
          .select('*')
          .eq('id', PRESIDENTS_CONTENT_ID)
          .single();
        const { data, error } = result ?? {};

        if (error) {
          console.warn(error);
          toast.error('Using default content. Apply the homepage_content migration before saving.');
          return;
        }

        if (data && isMounted) {
          setForm({
            names: data.presidents_names || DEFAULT_PRESIDENTS_CONTENT.names,
            role: data.presidents_role || DEFAULT_PRESIDENTS_CONTENT.role,
            message: data.presidents_message || DEFAULT_PRESIDENTS_CONTENT.message,
            photoUrl: data.presidents_photo_url || '',
          });
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to load homepage content');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadContent();

    return () => {
      isMounted = false;
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 1,
  });

  async function uploadPhoto(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage.from('presidents_images').upload(fileName, file);
    if (error) throw error;

    const { data } = supabase.storage.from('presidents_images').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      const photoUrl = photoFile ? await uploadPhoto(photoFile) : form.photoUrl.trim();
      const { error } = await supabase.from('homepage_content').upsert(
        {
          id: PRESIDENTS_CONTENT_ID,
          presidents_names: form.names.trim() || DEFAULT_PRESIDENTS_CONTENT.names,
          presidents_role: form.role.trim() || DEFAULT_PRESIDENTS_CONTENT.role,
          presidents_message: form.message.trim() || DEFAULT_PRESIDENTS_CONTENT.message,
          presidents_photo_url: photoUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) throw error;

      setForm((current) => ({ ...current, photoUrl }));
      setPhotoFile(null);
      setPhotoPreview('');
      toast.success('Presidents message saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save presidents message');
    } finally {
      setSaving(false);
    }
  }

  const previewPhoto = photoPreview || form.photoUrl;
  const previewParagraphs = splitPresidentsMessage(form.message);

  const fieldStyle = { borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' };

  return (
    <>
      <PageTitle title="Admin Content" />

      <div className="border-b" style={{ padding: '20px 28px 16px', borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <h1 className="font-sans font-semibold text-base tracking-[-0.01em]" style={{ color: 'var(--color-text)' }}>Homepage Content</h1>
        <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--color-text2)' }}>Edit the presidents message and photo shown on the main page.</p>
      </div>

      <div style={{ padding: '24px 28px' }}>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)] gap-6">
        <form
          onSubmit={handleSubmit}
          className="border rounded p-6 space-y-5"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Presidents *</label>
              <input type="text" value={form.names} onChange={(e) => setForm({ ...form, names: e.target.value })} className={inputCls} style={fieldStyle} required disabled={loading} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Role *</label>
              <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls} style={fieldStyle} required disabled={loading} />
            </div>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className={`${inputCls} min-h-[360px] leading-relaxed`}
              style={fieldStyle}
              required
              disabled={loading}
            />
            <p className="font-sans text-xs mt-2" style={{ color: 'var(--color-text3)' }}>
              Use blank lines to separate paragraphs. Single line breaks are preserved inside a paragraph.
            </p>
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Photo URL</label>
            <input type="url" value={form.photoUrl} onChange={(e) => { setForm({ ...form, photoUrl: e.target.value }); setPhotoFile(null); setPhotoPreview(''); }} className={inputCls} style={fieldStyle} placeholder="https://..." disabled={loading} />
          </div>

          <div>
            <label className={labelCls} style={{ color: 'var(--color-text3)' }}>Upload Photo</label>
            <div
              {...getRootProps()}
              className="mt-1 flex min-h-44 flex-col items-center justify-center border border-dashed rounded p-6 cursor-pointer transition-colors"
              style={{ borderColor: isDragActive ? 'var(--color-text2)' : 'var(--color-border)', background: isDragActive ? 'var(--color-surface2)' : 'transparent' }}
            >
              <input {...getInputProps()} />
              {previewPhoto ? (
                <img src={previewPhoto} alt="Presidents preview" className="max-h-52 rounded object-cover" />
              ) : (
                <p className="font-sans text-xs" style={{ color: 'var(--color-text3)' }}>Drag and drop or click to upload</p>
              )}
            </div>
            {previewPhoto && (
              <button type="button" className="mt-1.5 font-sans text-xs text-red-500 hover:text-red-400" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => { setForm({ ...form, photoUrl: '' }); setPhotoFile(null); setPhotoPreview(''); }}>
                Remove photo
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={loading || saving} className="font-sans font-medium px-5 py-2 rounded text-sm transition-colors disabled:opacity-50" style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving...' : 'Save Content'}
            </button>
            <button type="button" disabled={loading || saving} onClick={() => { setForm(DEFAULT_PRESIDENTS_CONTENT); setPhotoFile(null); setPhotoPreview(''); }}
              className="font-sans font-medium px-5 py-2 rounded text-sm border transition-colors disabled:opacity-50"
              style={{ color: 'var(--color-text2)', borderColor: 'var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
              Reset to Default
            </button>
          </div>
        </form>

        <aside className="border rounded overflow-hidden h-fit" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="font-sans font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Preview</h2>
          </div>
          <div className="p-5">
            <div className="mb-5 border rounded p-4 flex items-center justify-center" style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
              {previewPhoto ? (
                <img src={previewPhoto} alt={`${form.names} presidents preview`} className="w-full max-w-xs aspect-[4/5] object-cover rounded border" style={{ borderColor: 'var(--color-border)' }} />
              ) : (
                <div className="w-full max-w-xs aspect-[4/5] border border-dashed rounded flex items-center justify-center" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="text-center px-6">
                    <p className="font-serif text-2xl text-brand-600 dark:text-brand-400 mb-2">Photo</p>
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--color-text3)' }}>Presidents Photo</p>
                  </div>
                </div>
              )}
            </div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-600 dark:text-brand-400 mb-2">Presidents</p>
            <h2 className="font-sans font-semibold text-lg tracking-[-0.01em] mb-1" style={{ color: 'var(--color-text)' }}>
              {form.names || DEFAULT_PRESIDENTS_CONTENT.names}
            </h2>
            <p className="font-sans text-sm mb-5" style={{ color: 'var(--color-text2)' }}>
              {form.role || DEFAULT_PRESIDENTS_CONTENT.role}
            </p>
            <div className="space-y-3 font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              {previewParagraphs.map((paragraph, index) => (
                <p key={`${paragraph.slice(0, 24)}-${index}`} className="whitespace-pre-line">{paragraph}</p>
              ))}
            </div>
          </div>
        </aside>
      </div>
      </div>
    </>
  );
}

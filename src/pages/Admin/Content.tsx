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

const inputCls = 'mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-600';
const labelCls = 'block text-xs font-medium text-zinc-500 uppercase tracking-label';

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

  return (
    <div className="py-6">
      <PageTitle title="Admin Content" />

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Homepage Content
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Edit the presidents message and photo shown on the main page.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)] gap-6">
        <form
          onSubmit={handleSubmit}
          className="border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-md p-6 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Presidents *</label>
              <input
                type="text"
                value={form.names}
                onChange={(e) => setForm({ ...form, names: e.target.value })}
                className={inputCls}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className={labelCls}>Role *</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={inputCls}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className={`${inputCls} min-h-[360px] leading-relaxed`}
              required
              disabled={loading}
            />
            <p className="text-xs text-zinc-500 mt-2">
              Use blank lines to separate paragraphs. Single line breaks are preserved inside a paragraph.
            </p>
          </div>

          <div>
            <label className={labelCls}>Photo URL</label>
            <input
              type="url"
              value={form.photoUrl}
              onChange={(e) => {
                setForm({ ...form, photoUrl: e.target.value });
                setPhotoFile(null);
                setPhotoPreview('');
              }}
              className={inputCls}
              placeholder="https://..."
              disabled={loading}
            />
          </div>

          <div>
            <label className={labelCls}>Upload Photo</label>
            <div
              {...getRootProps()}
              className={`mt-1 flex min-h-44 flex-col items-center justify-center border border-dashed rounded p-6 cursor-pointer transition-colors ${
                isDragActive ? 'border-zinc-400 bg-zinc-800/20' : 'border-zinc-700'
              }`}
            >
              <input {...getInputProps()} />
              {previewPhoto ? (
                <img src={previewPhoto} alt="Presidents preview" className="max-h-52 rounded object-cover" />
              ) : (
                <p className="text-zinc-500 text-xs">Drag and drop or click to upload</p>
              )}
            </div>
            {previewPhoto && (
              <button
                type="button"
                className="mt-1.5 text-xs text-red-400 hover:text-red-300"
                onClick={() => {
                  setForm({ ...form, photoUrl: '' });
                  setPhotoFile(null);
                  setPhotoPreview('');
                }}
              >
                Remove photo
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || saving}
              className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-medium px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Content'}
            </button>
            <button
              type="button"
              disabled={loading || saving}
              onClick={() => {
                setForm(DEFAULT_PRESIDENTS_CONTENT);
                setPhotoFile(null);
                setPhotoPreview('');
              }}
              className="border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium px-5 py-2.5 rounded text-sm transition-colors disabled:opacity-50"
            >
              Reset to Default
            </button>
          </div>
        </form>

        <aside className="border border-zinc-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] rounded-md overflow-hidden h-fit">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Preview</h2>
          </div>
          <div className="p-5">
            <div className="mb-5 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md p-4 flex items-center justify-center">
              {previewPhoto ? (
                <img
                  src={previewPhoto}
                  alt={`${form.names} presidents preview`}
                  className="w-full max-w-xs aspect-[4/5] object-cover rounded border border-zinc-200 dark:border-zinc-800"
                />
              ) : (
                <div className="w-full max-w-xs aspect-[4/5] border border-dashed border-zinc-300 dark:border-zinc-700 rounded-md flex items-center justify-center">
                  <div className="text-center px-6">
                    <p className="text-3xl font-semibold text-brand-600 mb-2">GN + PL</p>
                    <p className="text-xs font-medium uppercase tracking-label text-zinc-500">
                      Presidents Photo
                    </p>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs font-medium uppercase tracking-label text-brand-600 dark:text-brand-400 mb-2">
              Presidents
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-1">
              {form.names || DEFAULT_PRESIDENTS_CONTENT.names}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              {form.role || DEFAULT_PRESIDENTS_CONTENT.role}
            </p>
            <div className="space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {previewParagraphs.map((paragraph, index) => (
                <p
                  key={`${paragraph.slice(0, 24)}-${index}`}
                  className={index === previewParagraphs.length - 1 ? 'text-zinc-700 dark:text-zinc-300 whitespace-pre-line' : 'whitespace-pre-line'}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

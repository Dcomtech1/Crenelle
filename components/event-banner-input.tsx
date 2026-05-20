'use client'

import { useState } from 'react'
import { UploadCloud, Link2, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { fieldCls, labelCls, hintCls } from '@/lib/form-styles'
import { toast } from 'sonner'

interface EventBannerInputProps {
  defaultValue?: string | null
}

export function EventBannerInput({ defaultValue }: EventBannerInputProps) {
  const [bannerUrl, setBannerUrl] = useState<string>(defaultValue || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()

      if (!file.type.startsWith('image/')) {
        throw new Error('Please select a valid image file.')
      }

      // Maximum 5MB banner file size limit
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB.')
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, file, {
          cacheControl: '31536000, immutable',
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName)

      setBannerUrl(publicUrl)
      toast.success('Banner uploaded successfully')
    } catch (err: any) {
      console.error('Upload error:', err)
      const msg = err.message || 'Failed to upload image'
      setError(msg)
      toast.error(
        'Upload failed. The "banners" storage bucket may not exist yet in Supabase. Please paste an image URL instead.'
      )
      // Switch to URL tab so user has alternative
      setActiveTab('url')
    } finally {
      setUploading(false)
    }
  }

  function handleRemove() {
    setBannerUrl('')
    setError(null)
  }

  return (
    <div className="flex flex-col gap-3 border-2 border-foreground/20 bg-foreground/5 p-4 rounded-sm">
      <div className="flex items-center justify-between">
        <label className={labelCls}>Event Banner Image</label>
        {bannerUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-7 px-2 font-mono text-[9px] uppercase tracking-widest text-denied hover:text-denied/80 border border-denied/20 hover:border-denied/40 flex items-center gap-1.5"
          >
            <X className="h-3 w-3" />
            Remove Banner
          </Button>
        )}
      </div>

      {/* Hidden field to submit in form action */}
      <input type="hidden" name="banner_url" value={bannerUrl} />

      {bannerUrl ? (
        <div className="relative border-2 border-foreground/30 aspect-video w-full overflow-hidden bg-void/50 group select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt="Event banner preview"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-linear-to-t from-void/80 to-transparent flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <span className="font-mono text-[9px] text-white uppercase tracking-widest">
              BANNER_ATTACHED // PREVIEW_READY
            </span>
          </div>
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'upload' | 'url')}
          className="w-full"
        >
          <TabsList variant="line" className="border-b-2 border-foreground/10 w-full justify-start mb-4">
            <TabsTrigger value="upload" className="font-mono text-xs uppercase tracking-widest px-4 py-2 border-b-2 border-transparent data-[state=active]:border-signal">
              Upload Image File
            </TabsTrigger>
            <TabsTrigger value="url" className="font-mono text-xs uppercase tracking-widest px-4 py-2 border-b-2 border-transparent data-[state=active]:border-signal">
              Paste Image URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-0">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-foreground/20 hover:border-foreground/50 aspect-video w-full cursor-pointer transition-all bg-background/5 hover:bg-background/20 group">
              {uploading ? (
                <div className="text-center flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 text-signal animate-spin" />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-signal animate-pulse">
                    UPLOADING_IMAGE_TO_STORAGE...
                  </p>
                </div>
              ) : (
                <div className="text-center p-6 flex flex-col items-center gap-3">
                  <UploadCloud className="h-10 w-10 text-foreground/40 group-hover:text-signal group-hover:scale-105 transition-all" />
                  <div className="space-y-1">
                    <p className="font-display text-base uppercase text-foreground leading-none">
                      Drag & drop or click to upload
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-foreground/40 mt-1">
                      PNG, JPG, WEBP up to 5MB
                    </p>
                  </div>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </TabsContent>

          <TabsContent value="url" className="mt-0 space-y-3">
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... or similar"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className={`${fieldCls} pl-10 h-12`}
                />
              </div>
              <p className={hintCls}>
                Paste any direct image URL. Great for hosting banners on Unsplash, Imgur, or postimg.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {error && (
        <p className="font-mono text-[9px] uppercase tracking-wide text-denied">
          ⚠ {error}
        </p>
      )}
    </div>
  )
}

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Download,
  Trash2,
  Edit3,
  Grid3X3,
  List,
  X,
  Check,
  Image as ImageIcon,
  ArrowUpDown,
  Loader2,
  ZoomIn,
  Package,
  MoreVertical,
  Crop,
  FileType,
  Settings2,
  Square,
  Sparkles,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

// Types
interface ImageData {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  format: string;
  aspectRatio: string;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'name' | 'size_asc' | 'size_desc';

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', desc: 'Cuadrado (Instagram)', w: 20, h: 20 },
  { label: '4:5', value: '4:5', desc: 'Retrato Instagram', w: 16, h: 20 },
  { label: '9:16', value: '9:16', desc: 'Stories / Reels', w: 12, h: 21 },
  { label: '16:9', value: '16:9', desc: 'Paisaje / YouTube', w: 24, h: 14 },
  { label: '3:2', value: '3:2', desc: 'Fotografía estándar', w: 18, h: 12 },
  { label: '2:3', value: '2:3', desc: 'Retrato estándar', w: 14, h: 21 },
  { label: '3:4', value: '3:4', desc: 'Retrato', w: 15, h: 20 },
  { label: '4:3', value: '4:3', desc: 'Paisaje clásico', w: 20, h: 15 },
];

const FORMATS = [
  { label: 'PNG', value: 'png', desc: 'Sin pérdida, mejor calidad' },
  { label: 'JPEG', value: 'jpeg', desc: 'Menor tamaño, buena calidad' },
  { label: 'WebP', value: 'webp', desc: 'Moderno, excelente compresión' },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper to get image URL - use static path if available, else API route
function getImageUrl(image: ImageData): string {
  if (image.filePath) {
    // Convert "public/images/file.png" to "/images/file.png"
    return '/' + image.filePath.replace(/^public\//, '');
  }
  return `/api/images/${image.id}/serve`;
}

function simplifyAspectRatio(ratio: string): string {
  const parts = ratio.split(':');
  if (parts.length !== 2) return ratio;
  const a = parseInt(parts[0]);
  const b = parseInt(parts[1]);
  if (isNaN(a) || isNaN(b)) return ratio;
  const r = a / b;
  const common: [number, number, string][] = [
    [1, 1, '1:1'], [4, 5, '4:5'], [5, 4, '5:4'],
    [3, 4, '3:4'], [4, 3, '4:3'], [2, 3, '2:3'],
    [3, 2, '3:2'], [9, 16, '9:16'], [16, 9, '16:9'],
  ];
  for (const [wa, wb, label] of common) {
    if (Math.abs(r - wa / wb) < 0.02) return label;
  }
  return ratio;
}

export default function Home() {
  const [allImages, setAllImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible] = useState(false);

  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<ImageData | null>(null);
  const [editAspectRatio, setEditAspectRatio] = useState('1:1');
  const [editFormat, setEditFormat] = useState('png');
  const [editQuality, setEditQuality] = useState(90);
  const [editing, setEditing] = useState(false);

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImageData | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageData | null>(null);

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const { toast } = useToast();

  // Cursor glow
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
      if (!cursorVisible) setCursorVisible(true);
    };
    const handleMouseLeave = () => setCursorVisible(false);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [cursorVisible]);

  // Initialize database (auto-seed if empty)
  const initializeDB = useCallback(async () => {
    try {
      setInitializing(true);
      const res = await fetch('/api/init');
      if (res.ok) {
        const data = await res.json();
        if (data.seeded) {
          toast({ title: 'Imágenes cargadas', description: data.message });
        }
      }
    } catch (err) {
      console.error('Error initializing:', err);
    } finally {
      setInitializing(false);
    }
  }, [toast]);

  // Fallback: load images from metadata.json if DB is unavailable
  const loadFromMetadata = useCallback(async () => {
    try {
      const res = await fetch('/images/metadata.json');
      if (res.ok) {
        const metadata = await res.json();
        return metadata.map((img: { file: string; originalName: string; mimeType: string; width: number; height: number; size: number; format: string; aspectRatio: string }) => ({
          id: `static-${img.file.replace(/\.[^/.]+$/, '')}`,
          name: img.file,
          originalName: img.originalName,
          mimeType: img.mimeType,
          width: img.width,
          height: img.height,
          size: img.size,
          format: img.format,
          aspectRatio: img.aspectRatio,
          filePath: `public/images/${img.file}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.error('Error loading metadata:', err);
    }
    return [];
  }, []);

  // Client-side search and sort
  const images = useMemo(() => {
    let result = [...allImages];

    // Search filter (case-insensitive)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((img) =>
        img.name.toLowerCase().includes(q) ||
        img.originalName.toLowerCase().includes(q) ||
        img.format.toLowerCase().includes(q) ||
        img.aspectRatio.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return a.originalName.localeCompare(b.originalName);
        case 'size_asc':
          return a.size - b.size;
        case 'size_desc':
          return b.size - a.size;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [allImages, search, sort]);

  // Fetch all images (no search/sort params - we filter client-side)
  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/images');
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setAllImages(data);
        } else {
          // Try initializing the DB
          await initializeDB();
          const res2 = await fetch('/api/images');
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.length > 0) {
              setAllImages(data2);
            } else {
              // Fallback to metadata.json
              const fallbackData = await loadFromMetadata();
              setAllImages(fallbackData);
            }
          }
        }
      } else {
        // API failed, use metadata.json fallback
        const fallbackData = await loadFromMetadata();
        setAllImages(fallbackData);
      }
    } catch (err) {
      console.error('Error fetching images:', err);
      // Try metadata.json fallback
      const fallbackData = await loadFromMetadata();
      if (fallbackData.length > 0) {
        setAllImages(fallbackData);
      } else {
        toast({ title: 'Error', description: 'No se pudieron cargar las imágenes', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [toast, initializeDB, loadFromMetadata]);

  useEffect(() => {
    fetchImages();
  }, []);

  // Download single
  const handleDownload = async (image: ImageData) => {
    try {
      // For static images (metadata.json fallback), use direct URL
      if (image.id.startsWith('static-')) {
        const url = getImageUrl(image);
        const a = document.createElement('a');
        a.href = url;
        a.download = image.originalName;
        a.click();
        toast({ title: 'Descargado', description: `${image.originalName}` });
        return;
      }
      const res = await fetch(`/api/images/${image.id}/download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.originalName;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Descargado', description: `${image.originalName}` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo descargar la imagen', variant: 'destructive' });
    }
  };

  // Bulk download
  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      const res = await fetch('/api/images/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jolie-images-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Descargado', description: `${selectedIds.size} imagen(es) descargadas en ZIP` });
      setSelectedIds(new Set());
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear el archivo ZIP', variant: 'destructive' });
    } finally {
      setBulkDownloading(false);
    }
  };

  // Delete single
  const handleDelete = async (image: ImageData) => {
    setDeleting(image.id);
    try {
      const res = await fetch(`/api/images/${image.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAllImages((prev) => prev.filter((img) => img.id !== image.id));
        setSelectedIds((prev) => { const next = new Set(prev); next.delete(image.id); return next; });
        toast({ title: 'Eliminada', description: `${image.originalName} fue eliminada` });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar la imagen', variant: 'destructive' });
    } finally {
      setDeleting(null);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try { await fetch(`/api/images/${id}`, { method: 'DELETE' }); } catch { /* continue */ }
    }
    setAllImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
    setSelectedIds(new Set());
    setBulkDeleteDialogOpen(false);
    toast({ title: 'Eliminadas', description: `${ids.length} imagen(es) eliminada(s)` });
  };

  // Edit image
  const handleEdit = async () => {
    if (!editingImage) return;
    setEditing(true);
    try {
      const res = await fetch(`/api/images/${editingImage.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspectRatio: editAspectRatio, format: editFormat, quality: editQuality }),
      });
      if (res.ok) {
        const newImage = await res.json();
        setAllImages((prev) => [newImage, ...prev]);
        toast({ title: 'Imagen editada', description: `Nueva versión creada con ratio ${editAspectRatio} en formato ${editFormat.toUpperCase()}` });
        setEditDialogOpen(false);
        setEditingImage(null);
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'No se pudo editar la imagen', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo editar la imagen', variant: 'destructive' });
    } finally {
      setEditing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === images.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(images.map((img) => img.id)));
  };

  const openEditDialog = (image: ImageData) => {
    setEditingImage(image);
    const fmt = FORMATS.find((f) => f.value === image.format);
    setEditFormat(fmt ? fmt.value : 'png');
    setEditAspectRatio('1:1');
    setEditQuality(90);
    setEditDialogOpen(true);
  };

  const openPreview = (image: ImageData) => {
    setPreviewImage(image);
    setPreviewDialogOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      {/* Cursor Glow */}
      <div
        className="cursor-glow"
        style={{
          transform: `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`,
          opacity: cursorVisible ? 1 : 0,
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[rgba(212,175,55,0.1)]">
        {/* Top accent line */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8941e] flex items-center justify-center gold-glow">
                <Sparkles className="w-5 h-5 text-[#0a0a0a]" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight font-serif shimmer-text">
                  Jolie Fragrances
                </h1>
                <p className="text-[10px] text-[#888] tracking-[0.2em] uppercase">Gestor de Publicaciones</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888] group-focus-within:text-[#d4af37] transition-colors" />
                <Input
                  placeholder="Buscar imagen por nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 h-10 bg-[#111] border-[rgba(212,175,55,0.15)] text-white placeholder:text-[#555] focus:border-[#d4af37]/40 focus:ring-[#d4af37]/20 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#d4af37] transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Refresh */}
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-[#888] hover:text-[#d4af37] hover:bg-[#d4af37]/10"
                onClick={() => fetchImages()}
                title="Recargar imágenes"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>

              {/* Sort */}
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="w-[140px] h-10 bg-[#111] border-[rgba(212,175,55,0.15)] text-white">
                  <ArrowUpDown className="w-4 h-4 mr-2 text-[#d4af37]" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[rgba(212,175,55,0.15)]">
                  <SelectItem value="newest">Más nuevas</SelectItem>
                  <SelectItem value="oldest">Más antiguas</SelectItem>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="size_desc">Mayor tamaño</SelectItem>
                  <SelectItem value="size_asc">Menor tamaño</SelectItem>
                </SelectContent>
              </Select>

              {/* View mode */}
              <div className="flex border border-[rgba(212,175,55,0.15)] rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className={`rounded-none h-10 px-3 ${viewMode === 'grid' ? 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e8cc6e]' : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'}`}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className={`rounded-none h-10 px-3 ${viewMode === 'list' ? 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e8cc6e]' : 'text-[#888] hover:text-white hover:bg-[#1a1a1a]'}`}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Admin badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 h-10 rounded-md bg-[#111] border border-[rgba(212,175,55,0.1)] text-[#555] text-xs">
                <Lock className="h-3.5 w-3.5" />
                <span>Solo admin</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-[73px] z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[rgba(212,175,55,0.15)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox checked={selectedIds.size === images.length} onCheckedChange={toggleSelectAll} className="border-[#d4af37]/40 data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]" />
              <span className="text-sm font-medium text-[#d4af37]">
                {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 border-[rgba(212,175,55,0.2)] text-[#d4af37] hover:bg-[#d4af37]/10 hover:text-[#e8cc6e]" onClick={handleBulkDownload} disabled={bulkDownloading}>
                {bulkDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                Descargar ZIP
              </Button>
              <Button variant="outline" size="sm" className="gap-2 border-red-900/40 text-red-400 hover:bg-red-900/20 hover:text-red-300" onClick={() => setBulkDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
              <Button variant="ghost" size="sm" className="text-[#888] hover:text-white" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 hero-gradient">
        {loading || initializing ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[rgba(212,175,55,0.2)] border-t-[#d4af37] animate-spin" />
            <p className="text-[#888] font-serif">{initializing ? 'Inicializando imágenes...' : 'Cargando imágenes...'}</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#111] to-[#1a1a1a] border border-[rgba(212,175,55,0.15)] flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-[#d4af37]/40" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-serif font-semibold text-white">No hay imágenes</h3>
              <p className="text-[#888] text-sm mt-2 max-w-xs">
                {search ? 'No se encontraron resultados para tu búsqueda' : 'Las imágenes se agregan por administración'}
              </p>
              {!search && (
                <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-[#111] border border-[rgba(212,175,55,0.1)]">
                  <Lock className="h-4 w-4 text-[#d4af37]/50" />
                  <p className="text-[#555] text-xs">Las imágenes son gestionadas por el administrador</p>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((image, index) => (
              <Card
                key={image.id}
                className={`group relative overflow-hidden cursor-pointer bg-[#111] border transition-all duration-300 image-card card-fade-in ${
                  selectedIds.has(image.id)
                    ? 'border-[#d4af37]/50 selected-card-glow'
                    : 'border-[rgba(212,175,55,0.08)] hover:border-[rgba(212,175,55,0.25)]'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Selection checkbox */}
                <div className="absolute top-2 left-2 z-10" onClick={(e) => { e.stopPropagation(); toggleSelect(image.id); }}>
                  {selectedIds.has(image.id) ? (
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#d4af37] to-[#b8941e] flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-[#0a0a0a]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-[#0a0a0a]/80 backdrop-blur border border-[rgba(212,175,55,0.2)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Square className="w-4 h-4 text-[#888]" />
                    </div>
                  )}
                </div>

                {/* Image thumbnail */}
                <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]" onClick={() => openPreview(image)}>
                  <img
                    src={getImageUrl(image)}
                    alt={image.originalName}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-full bg-[#d4af37]/20 backdrop-blur-sm border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/30 gap-1.5"
                      onClick={(e) => { e.stopPropagation(); openPreview(image); }}
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                      Vista previa
                    </Button>
                  </div>
                </div>

                {/* Card footer */}
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate text-white" title={image.originalName}>
                    {image.originalName.replace(/\.[^/.]+$/, '')}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge className="text-[10px] px-1.5 py-0 h-5 bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20 hover:bg-[#d4af37]/15">
                      {simplifyAspectRatio(image.aspectRatio)}
                    </Badge>
                    <span className="text-[10px] text-[#666]">
                      {image.width}×{image.height}
                    </span>
                    <span className="text-[10px] text-[#555] uppercase">
                      {image.format}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#555] mt-0.5">
                    {formatFileSize(image.size)}
                  </p>
                </CardContent>

                {/* Quick actions */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full bg-[#0a0a0a]/80 backdrop-blur border border-[rgba(212,175,55,0.2)] text-[#d4af37] hover:bg-[#d4af37]/20 hover:text-[#e8cc6e] shadow-lg">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 bg-[#111] border-[rgba(212,175,55,0.15)]">
                      <DropdownMenuItem onClick={() => handleDownload(image)} className="text-[#ccc] focus:text-[#d4af37] focus:bg-[#d4af37]/10">
                        <Download className="h-4 w-4 mr-2" />
                        Descargar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(image)} className="text-[#ccc] focus:text-[#d4af37] focus:bg-[#d4af37]/10">
                        <Edit3 className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-[rgba(212,175,55,0.1)]" />
                      <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-900/20" onClick={() => { setDeleteTarget(image); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="space-y-2">
            {images.map((image, index) => (
              <Card
                key={image.id}
                className={`flex items-center gap-4 p-3 cursor-pointer bg-[#111] border transition-all duration-300 image-card card-fade-in ${
                  selectedIds.has(image.id)
                    ? 'border-[#d4af37]/50 selected-card-glow'
                    : 'border-[rgba(212,175,55,0.08)] hover:border-[rgba(212,175,55,0.25)]'
                }`}
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => toggleSelect(image.id)}
              >
                <Checkbox checked={selectedIds.has(image.id)} onCheckedChange={() => toggleSelect(image.id)} className="border-[#d4af37]/40 data-[state=checked]:bg-[#d4af37] data-[state=checked]:border-[#d4af37]" />
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] shrink-0 border border-[rgba(212,175,55,0.08)]" onClick={(e) => { e.stopPropagation(); openPreview(image); }}>
                  <img src={getImageUrl(image)} alt={image.originalName} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-white">{image.originalName}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#888]">
                    <span>{image.width}×{image.height}</span>
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20">
                      {simplifyAspectRatio(image.aspectRatio)}
                    </Badge>
                    <span className="uppercase">{image.format}</span>
                    <span>{formatFileSize(image.size)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#888] hover:text-[#d4af37] hover:bg-[#d4af37]/10" onClick={() => handleDownload(image)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#888] hover:text-[#d4af37] hover:bg-[#d4af37]/10" onClick={() => openEditDialog(image)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400/60 hover:text-red-400 hover:bg-red-900/20" onClick={() => { setDeleteTarget(image); setDeleteDialogOpen(true); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(212,175,55,0.1)] bg-[#0a0a0a] mt-auto footer-reveal">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-sm text-[#555]">
          <span className="font-serif">{images.length} imagen{images.length !== 1 ? 'es' : ''}</span>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-[#d4af37]/40" />
            <span className="font-serif text-[#888]">Jolie Fragrances</span>
          </div>
        </div>
      </footer>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-[#0a0a0a] border-[rgba(212,175,55,0.15)]">
          {previewImage && (
            <>
              <div className="relative bg-[#0a0a0a] flex items-center justify-center max-h-[70vh] overflow-auto">
                <img src={getImageUrl(previewImage)} alt={previewImage.originalName} className="max-w-full max-h-[70vh] object-contain" />
              </div>
              <div className="p-5 space-y-4 bg-[#0a0a0a]">
                <DialogHeader>
                  <DialogTitle className="text-base font-serif text-white">{previewImage.originalName}</DialogTitle>
                  <DialogDescription className="text-sm text-[#888]">
                    {previewImage.width}×{previewImage.height} · {simplifyAspectRatio(previewImage.aspectRatio)} · {previewImage.format.toUpperCase()} · {formatFileSize(previewImage.size)}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-[#d4af37] to-[#b8941e] text-[#0a0a0a] hover:from-[#e8cc6e] hover:to-[#d4af37] font-semibold" onClick={() => handleDownload(previewImage)}>
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 border-[rgba(212,175,55,0.2)] text-[#d4af37] hover:bg-[#d4af37]/10" onClick={() => { setPreviewDialogOpen(false); openEditDialog(previewImage); }}>
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg bg-[#0a0a0a] border-[rgba(212,175,55,0.15)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-white">
              <Settings2 className="h-5 w-5 text-[#d4af37]" />
              Editar imagen
            </DialogTitle>
            <DialogDescription className="text-[#888]">
              Cambia el aspect ratio y formato de tu imagen. Se creará una nueva versión.
            </DialogDescription>
          </DialogHeader>

          {editingImage && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-[#111] to-[#1a1a1a] shrink-0 border border-[rgba(212,175,55,0.1)]">
                  <img src={getImageUrl(editingImage)} alt={editingImage.originalName} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-white">{editingImage.originalName}</p>
                  <p className="text-xs text-[#888] mt-1">
                    Original: {editingImage.width}×{editingImage.height} ({simplifyAspectRatio(editingImage.aspectRatio)})
                  </p>
                  <p className="text-xs text-[#666]">
                    {editingImage.format.toUpperCase()} · {formatFileSize(editingImage.size)}
                  </p>
                </div>
              </div>

              <Separator className="bg-[rgba(212,175,55,0.1)]" />

              {/* Aspect Ratio */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Crop className="h-4 w-4 text-[#d4af37]" />
                  Aspect Ratio
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => setEditAspectRatio(ar.value)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all text-center ${
                        editAspectRatio === ar.value
                          ? 'border-[#d4af37] bg-[#d4af37]/8'
                          : 'border-[rgba(212,175,55,0.08)] bg-[#111] hover:bg-[#1a1a1a] hover:border-[rgba(212,175,55,0.15)]'
                      }`}
                    >
                      <div
                        className="rounded-sm bg-current"
                        style={{
                          width: `${ar.w}px`,
                          height: `${ar.h}px`,
                          color: editAspectRatio === ar.value ? '#d4af37' : '#555',
                        }}
                      />
                      <span className={`text-[11px] font-medium ${editAspectRatio === ar.value ? 'text-[#d4af37]' : 'text-[#888]'}`}>
                        {ar.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#888]">
                  {ASPECT_RATIOS.find((ar) => ar.value === editAspectRatio)?.desc}
                </p>
              </div>

              <Separator className="bg-[rgba(212,175,55,0.1)]" />

              {/* Format */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FileType className="h-4 w-4 text-[#d4af37]" />
                  Formato de salida
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setEditFormat(f.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        editFormat === f.value
                          ? 'border-[#d4af37] bg-[#d4af37]/8'
                          : 'border-[rgba(212,175,55,0.08)] bg-[#111] hover:bg-[#1a1a1a] hover:border-[rgba(212,175,55,0.15)]'
                      }`}
                    >
                      <span className={`text-sm font-bold ${editFormat === f.value ? 'text-[#d4af37]' : 'text-[#ccc]'}`}>{f.label}</span>
                      <span className="text-[10px] text-[#888] text-center">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              {(editFormat === 'jpeg' || editFormat === 'webp') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-white">Calidad</Label>
                    <span className="text-sm text-[#d4af37] font-medium">{editQuality}%</span>
                  </div>
                  <Slider
                    value={[editQuality]}
                    onValueChange={([v]) => setEditQuality(v)}
                    min={10} max={100} step={5}
                    className="[&_[role=slider]]:bg-[#d4af37] [&_[role=slider]]:border-[#d4af37]"
                  />
                  <div className="flex justify-between text-[10px] text-[#666]">
                    <span>Menor tamaño</span>
                    <span>Mayor calidad</span>
                  </div>
                </div>
              )}

              <Separator className="bg-[rgba(212,175,55,0.1)]" />

              {/* Result preview */}
              <div className="bg-[#111] rounded-lg p-3 text-sm space-y-1 border border-[rgba(212,175,55,0.08)]">
                <p className="font-medium text-white font-serif">Vista previa del resultado:</p>
                <p className="text-[#888]">
                  Ratio: <span className="text-[#d4af37] font-medium">{editAspectRatio}</span> ·
                  Formato: <span className="text-[#d4af37] font-medium">{editFormat.toUpperCase()}</span>
                  {(editFormat === 'jpeg' || editFormat === 'webp') && (
                    <> · Calidad: <span className="text-[#d4af37] font-medium">{editQuality}%</span></>
                  )}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="border-[rgba(212,175,55,0.2)] text-[#888] hover:text-white hover:bg-[#1a1a1a]">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleEdit} disabled={editing} className="gap-2 bg-gradient-to-r from-[#d4af37] to-[#b8941e] text-[#0a0a0a] hover:from-[#e8cc6e] hover:to-[#d4af37] font-semibold gold-glow-hover">
              {editing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
              Crear versión editada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#111] border-[rgba(212,175,55,0.15)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-serif">¿Eliminar imagen?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#888]">
              {deleteTarget && (
                <>Se eliminará <strong className="text-white">{deleteTarget.originalName}</strong> permanentemente. Esta acción no se puede deshacer.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a1a] border-[rgba(212,175,55,0.15)] text-[#888] hover:text-white hover:bg-[#222]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-red-900/80 text-red-100 hover:bg-red-800 border-0">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#111] border-[rgba(212,175,55,0.15)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-serif">¿Eliminar {selectedIds.size} imágenes?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#888]">
              Se eliminarán permanentemente {selectedIds.size} imagen{selectedIds.size !== 1 ? 'es' : ''}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#1a1a1a] border-[rgba(212,175,55,0.15)] text-[#888] hover:text-white hover:bg-[#222]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-900/80 text-red-100 hover:bg-red-800 border-0">
              Eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}

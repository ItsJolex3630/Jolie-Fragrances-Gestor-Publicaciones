'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Upload,
  Download,
  Trash2,
  Edit3,
  Grid3X3,
  List,
  X,
  Check,
  Image as ImageIcon,
  Filter,
  ArrowUpDown,
  Loader2,
  ZoomIn,
  Package,
  MoreVertical,
  Crop,
  FileType,
  Settings2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
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
  path: string;
  width: number;
  height: number;
  size: number;
  format: string;
  aspectRatio: string;
  createdAt: string;
  updatedAt: string;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'name' | 'size_asc' | 'size_desc';

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', desc: 'Cuadrado (Instagram)' },
  { label: '4:5', value: '4:5', desc: 'Retrato Instagram' },
  { label: '9:16', value: '9:16', desc: 'Stories / Reels' },
  { label: '16:9', value: '16:9', desc: 'Paisaje / YouTube' },
  { label: '3:2', value: '3:2', desc: 'Fotografía estándar' },
  { label: '2:3', value: '2:3', desc: 'Retrato estándar' },
  { label: '3:4', value: '3:4', desc: 'Retrato' },
  { label: '4:3', value: '4:3', desc: 'Paisaje clásico' },
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

function simplifyAspectRatio(ratio: string): string {
  const parts = ratio.split(':');
  if (parts.length !== 2) return ratio;
  const a = parseInt(parts[0]);
  const b = parseInt(parts[1]);
  if (isNaN(a) || isNaN(b)) return ratio;

  // Try to match common ratios
  const r = a / b;
  const common: [number, number, string][] = [
    [1, 1, '1:1'],
    [4, 5, '4:5'],
    [5, 4, '5:4'],
    [3, 4, '3:4'],
    [4, 3, '4:3'],
    [2, 3, '2:3'],
    [3, 2, '3:2'],
    [9, 16, '9:16'],
    [16, 9, '16:9'],
  ];
  for (const [wa, wb, label] of common) {
    if (Math.abs(r - wa / wb) < 0.02) return label;
  }
  return ratio;
}

export default function Home() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch images
  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('sort', sort);
      const res = await fetch(`/api/images?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (err) {
      console.error('Error fetching images:', err);
      toast({ title: 'Error', description: 'No se pudieron cargar las imágenes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, sort, toast]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/images', { method: 'POST', body: formData });
        if (res.ok) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await fetchImages();

    if (successCount > 0) {
      toast({ title: 'Carga exitosa', description: `${successCount} imagen(es) subida(s)` });
    }
    if (errorCount > 0) {
      toast({ title: 'Error', description: `${errorCount} imagen(es) fallaron al subir`, variant: 'destructive' });
    }
  };

  // Download single
  const handleDownload = async (image: ImageData) => {
    try {
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
      a.download = `imagenes-${Date.now()}.zip`;
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
        setImages((prev) => prev.filter((img) => img.id !== image.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(image.id);
          return next;
        });
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
      try {
        await fetch(`/api/images/${id}`, { method: 'DELETE' });
      } catch { /* continue */ }
    }
    setImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
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
        body: JSON.stringify({
          aspectRatio: editAspectRatio,
          format: editFormat,
          quality: editQuality,
        }),
      });
      if (res.ok) {
        const newImage = await res.json();
        setImages((prev) => [newImage, ...prev]);
        toast({
          title: 'Imagen editada',
          description: `Nueva versión creada con ratio ${editAspectRatio} en formato ${editFormat.toUpperCase()}`,
        });
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

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((img) => img.id)));
    }
  };

  const openEditDialog = (image: ImageData) => {
    setEditingImage(image);
    // Set default format to same as original
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">ImageFlow</h1>
                <p className="text-xs text-muted-foreground">Gestor de imágenes</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 h-10"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Sort */}
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger className="w-[140px] h-10">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Más nuevas</SelectItem>
                  <SelectItem value="oldest">Más antiguas</SelectItem>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="size_desc">Mayor tamaño</SelectItem>
                  <SelectItem value="size_asc">Menor tamaño</SelectItem>
                </SelectContent>
              </Select>

              {/* View mode */}
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none h-10 px-3"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none h-10 px-3"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Upload */}
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-10 gap-2"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{uploading ? 'Subiendo...' : 'Subir'}</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-[73px] z-40 bg-background/95 backdrop-blur border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.size === images.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm font-medium">
                {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleBulkDownload}
                disabled={bulkDownloading}
              >
                {bulkDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                Descargar ZIP
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Cargando imágenes...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
              <ImageIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">No hay imágenes</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {search ? 'No se encontraron resultados para tu búsqueda' : 'Sube tu primera imagen para comenzar'}
              </p>
            </div>
            {!search && (
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" />
                Subir imagen
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map((image) => (
              <Card
                key={image.id}
                className={`group relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  selectedIds.has(image.id) ? 'ring-2 ring-primary' : ''
                }`}
              >
                {/* Selection checkbox */}
                <div
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(image.id);
                  }}
                >
                  {selectedIds.has(image.id) ? (
                    <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shadow-md">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-background/80 backdrop-blur border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Square className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Image thumbnail */}
                <div
                  className="relative aspect-square overflow-hidden bg-muted"
                  onClick={() => openPreview(image)}
                >
                  <img
                    src={`/api/images/${image.id}/serve`}
                    alt={image.originalName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(image);
                      }}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Card footer */}
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate" title={image.originalName}>
                    {image.originalName.replace(/\.[^/.]+$/, '')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      {simplifyAspectRatio(image.aspectRatio)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {image.width}×{image.height}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {image.format.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatFileSize(image.size)}
                  </p>
                </CardContent>

                {/* Quick actions */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow-md">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => handleDownload(image)}>
                        <Download className="h-4 w-4 mr-2" />
                        Descargar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(image)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setDeleteTarget(image);
                          setDeleteDialogOpen(true);
                        }}
                      >
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
            {images.map((image) => (
              <Card
                key={image.id}
                className={`flex items-center gap-4 p-3 cursor-pointer transition-all hover:shadow-md ${
                  selectedIds.has(image.id) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => toggleSelect(image.id)}
              >
                <Checkbox
                  checked={selectedIds.has(image.id)}
                  onCheckedChange={() => toggleSelect(image.id)}
                />
                <div
                  className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPreview(image);
                  }}
                >
                  <img
                    src={`/api/images/${image.id}/serve`}
                    alt={image.originalName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{image.originalName}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{image.width}×{image.height}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {simplifyAspectRatio(image.aspectRatio)}
                    </Badge>
                    <span>{image.format.toUpperCase()}</span>
                    <span>{formatFileSize(image.size)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(image)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(image)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      setDeleteTarget(image);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{images.length} imagen{images.length !== 1 ? 'es' : ''}</span>
          <span>ImageFlow · Gestor de imágenes</span>
        </div>
      </footer>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          {previewImage && (
            <>
              <div className="relative bg-muted/50 flex items-center justify-center max-h-[70vh] overflow-auto">
                <img
                  src={`/api/images/${previewImage.id}/serve`}
                  alt={previewImage.originalName}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              </div>
              <div className="p-4 space-y-3">
                <DialogHeader>
                  <DialogTitle className="text-base">{previewImage.originalName}</DialogTitle>
                  <DialogDescription className="text-sm">
                    {previewImage.width}×{previewImage.height} · {simplifyAspectRatio(previewImage.aspectRatio)} · {previewImage.format.toUpperCase()} · {formatFileSize(previewImage.size)}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-2" onClick={() => handleDownload(previewImage)}>
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                    setPreviewDialogOpen(false);
                    openEditDialog(previewImage);
                  }}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Editar imagen
            </DialogTitle>
            <DialogDescription>
              Cambia el aspect ratio y formato de tu imagen. Se creará una nueva versión.
            </DialogDescription>
          </DialogHeader>

          {editingImage && (
            <div className="space-y-6">
              {/* Preview */}
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img
                    src={`/api/images/${editingImage.id}/serve`}
                    alt={editingImage.originalName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{editingImage.originalName}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Original: {editingImage.width}×{editingImage.height} ({simplifyAspectRatio(editingImage.aspectRatio)})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {editingImage.format.toUpperCase()} · {formatFileSize(editingImage.size)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Aspect Ratio */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Crop className="h-4 w-4" />
                  Aspect Ratio
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      onClick={() => setEditAspectRatio(ar.value)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-center ${
                        editAspectRatio === ar.value
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      {/* Visual ratio indicator */}
                      <div
                        className="bg-current rounded-sm"
                        style={{
                          width: ar.value === '1:1' ? '20px' : ar.value === '9:16' ? '12px' : ar.value === '16:9' ? '24px' : ar.value === '4:5' ? '16px' : ar.value === '3:4' ? '15px' : ar.value === '4:3' ? '20px' : ar.value === '2:3' ? '14px' : '18px',
                          height: ar.value === '1:1' ? '20px' : ar.value === '9:16' ? '21px' : ar.value === '16:9' ? '14px' : ar.value === '4:5' ? '20px' : ar.value === '3:4' ? '20px' : ar.value === '4:3' ? '15px' : ar.value === '2:3' ? '21px' : '18px',
                          opacity: editAspectRatio === ar.value ? 1 : 0.4,
                        }}
                      />
                      <span className="text-xs font-medium">{ar.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {ASPECT_RATIOS.find((ar) => ar.value === editAspectRatio)?.desc}
                </p>
              </div>

              <Separator />

              {/* Format */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <FileType className="h-4 w-4" />
                  Formato de salida
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setEditFormat(f.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        editFormat === f.value
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <span className="text-sm font-bold">{f.label}</span>
                      <span className="text-[10px] text-muted-foreground text-center">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality (for jpeg/webp) */}
              {(editFormat === 'jpeg' || editFormat === 'webp') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Calidad</Label>
                    <span className="text-sm text-muted-foreground">{editQuality}%</span>
                  </div>
                  <Slider
                    value={[editQuality]}
                    onValueChange={([v]) => setEditQuality(v)}
                    min={10}
                    max={100}
                    step={5}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Menor tamaño</span>
                    <span>Mayor calidad</span>
                  </div>
                </div>
              )}

              <Separator />

              {/* Result preview info */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium">Vista previa del resultado:</p>
                <p className="text-muted-foreground">
                  Ratio: <span className="text-foreground font-medium">{editAspectRatio}</span> ·
                  Formato: <span className="text-foreground font-medium">{editFormat.toUpperCase()}</span>
                  {(editFormat === 'jpeg' || editFormat === 'webp') && (
                    <> · Calidad: <span className="text-foreground font-medium">{editQuality}%</span></>
                  )}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleEdit} disabled={editing} className="gap-2">
              {editing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
              Crear versión editada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar imagen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Se eliminará <strong>{deleteTarget.originalName}</strong> permanentemente.
                  Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedIds.size} imágenes?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente {selectedIds.size} imagen{selectedIds.size !== 1 ? 'es' : ''}.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}

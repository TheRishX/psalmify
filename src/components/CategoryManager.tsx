import React, { useState } from 'react';
import { db, OperationType, handleFirestoreError } from '../utils/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Genre } from '../types';
import { 
  Layers, Plus, Trash2, Edit3, X, AlertTriangle, 
  Search, Check, Sparkles, FolderPlus, HelpCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CategoryManagerProps {
  genres: Genre[];
  songsCountByCategory: Record<string, number>;
}

export default function CategoryManager({ genres, songsCountByCategory }: CategoryManagerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Genre | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const openCreateModal = () => {
    setName('');
    setDescription('');
    setError('');
    setEditingCategory(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (cat: Genre) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setError('');
    setIsCreateModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const categoryId = editingCategory ? editingCategory.id : name.trim().toLowerCase().replace(/\s+/g, '-');
      
      const payload: Partial<Genre> = {
        id: categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        createdAt: editingCategory?.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, "genres", categoryId), payload).catch((error) => {
        handleFirestoreError(error, OperationType.CREATE, `genres/${categoryId}`);
      });

      setIsCreateModalOpen(false);
      setName('');
      setDescription('');
      setEditingCategory(null);
    } catch (err: any) {
      console.error("Failed saving category:", err);
      setError(err?.message || "Failed to save category. Please check Firestore permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const songCount = songsCountByCategory[id] || songsCountByCategory[name] || 0;
    const confirmMessage = songCount > 0
      ? `Warning: There are ${songCount} songs associated with the category "${name}". Are you absolutely sure you want to delete this category? (Songs' category will fall back to general explore).`
      : `Are you sure you want to delete the category "${name}"?`;

    if (window.confirm(confirmMessage)) {
      try {
        await deleteDoc(doc(db, "genres", id)).catch((error) => {
          handleFirestoreError(error, OperationType.DELETE, `genres/${id}`);
        });
      } catch (err: any) {
        console.error("Failed deleting category:", err);
        alert("Failed to delete category: " + (err?.message || "Check permissions."));
      }
    }
  };

  const filteredCategories = genres.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cat.description && cat.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div id="category-manager-container" className="space-y-6">
      
      {/* Header card with action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight">Interactive Categories Hub</h2>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm">
            Organize song directories seamlessly. Create, edit, and delete categories in real-time.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-3 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/10 transition cursor-pointer self-start sm:self-center"
        >
          <FolderPlus className="w-4 h-4" />
          Create Category
        </button>
      </div>

      {/* Filter and stats segment */}
      <div className="flex items-center gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 hover:bg-slate-100/55 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition"
          />
        </div>
        <div className="hidden md:flex items-center gap-2.5 text-xs font-mono text-slate-500">
          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200/60 rounded-lg">
            Total of {genres.length} directories
          </span>
        </div>
      </div>

      {/* Category bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredCategories.map((cat) => {
            const songCount = songsCountByCategory[cat.id] || songsCountByCategory[cat.name] || 0;
            return (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md rounded-2xl p-5 flex flex-col justify-between transition group"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 tracking-tight text-sm text-[15px] group-hover:text-emerald-600 transition">
                      {cat.name}
                    </h3>
                    <span className="inline-flex items-center text-[10px] font-mono font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 uppercase">
                      {songCount} {songCount === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed min-h-[36px]">
                    {cat.description || "No description provided for this catalog branch."}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-4 border-t border-slate-100 mt-4">
                  <button
                    onClick={() => openEditModal(cat)}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    title="Edit name or descriptor"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.name)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredCategories.length === 0 && (
          <div className="col-span-full py-12 bg-slate-50 border border-slate-200/60 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Layers className="w-8 h-8 text-slate-300 mb-2 animate-bounce" />
            <p className="font-semibold text-xs">No Categories Registered</p>
            <p className="text-[11px] max-w-sm mt-1">
              {searchQuery ? "Try sharpening your search filter string." : "Create your first category using the button above to populate this catalog list."}
            </p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white border border-slate-200 text-slate-950 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute right-4 top-4">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold tracking-tight text-slate-900">
                  {editingCategory ? 'Edit Directory Details' : 'Register New Category'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gospel, Contemporary Worship"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={editingCategory !== null} // Cannot rename ID, create new or patch desc remains best
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition disabled:opacity-55"
                  />
                  {editingCategory && (
                    <p className="text-[9px] text-slate-400 font-mono italic">
                      Locked: Editing properties of established category ID: {editingCategory.id}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    Description Descriptor
                  </label>
                  <textarea
                    placeholder="Write a brief, visual description of this category (instruments, pacing, tempo)."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-xl outline-none transition resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold hover:bg-slate-100 rounded-xl border border-transparent hover:border-slate-200 text-slate-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 rounded-xl shadow-md transition flex items-center gap-2"
                  >
                    {isSubmitting ? 'Processing...' : (editingCategory ? 'Update Properties' : 'Create Category')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

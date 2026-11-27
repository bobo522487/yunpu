import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { errorMessage } from '../../../lib/api';
import { useBookStore } from '../../../store/useBookStore';
import ConfirmDialog from '../../dashboard/components/ConfirmDialog';
import { useBookActions, useBooksQuery } from '../queries';
import type { BookMetaInput, BookRecord } from '../types';
import { BookCoverThumb } from './BookCoverThumb';
import { BookMetaModal } from './BookMetaModal';

interface BookModalState {
  open: boolean;
  mode: 'create' | 'edit';
  bookId?: string;
  initialValue?: Partial<BookMetaInput>;
}

export const BookListPanel: React.FC = () => {
  const {
    projectId: activeProjectId,
    project: activeProject,
    surname: projectSurname,
  } = useActiveProject();

  const { data: books = [] } = useBooksQuery(activeProjectId);
  const selectedBookIdByProject = useBookStore(
    (s) => s.selectedBookIdByProject,
  );
  const selectBook = useBookStore((s) => s.selectBook);
  const {
    createBook,
    updateBookMeta,
    duplicateBook,
    deleteBook,
    moveBook,
  } = useBookActions(activeProjectId);

  const [modalState, setModalState] = useState<BookModalState>({
    open: false,
    mode: 'create',
  });
  const [deleteTarget, setDeleteTarget] = useState<BookRecord | null>(null);

  const selectedBookId =
    selectedBookIdByProject[activeProjectId] || books[0]?.id || '';

  const openCreateModal = () => {
    const familyLabel = activeProject?.name || '本族';
    setModalState({
      open: true,
      mode: 'create',
      initialValue: {
        bookName: familyLabel.includes('谱')
          ? familyLabel
          : `${familyLabel}族谱`,
        headerName: projectSurname ? `${projectSurname}氏宗谱` : familyLabel,
        hallName:
          activeProject?.hallName ||
          (projectSurname ? `${projectSurname}氏宗堂` : ''),
        volumeNo: `卷${books.length + 1}`,
        editor: activeProject?.hallName
          ? `${activeProject.hallName}编委会`
          : '家族编委会',
        compilationDate: new Date().toISOString().slice(0, 10),
      },
    });
  };

  const openEditModal = (book: BookRecord) => {
    setModalState({
      open: true,
      mode: 'edit',
      bookId: book.id,
      initialValue: {
        bookName: book.bookName,
        headerName: book.headerName,
        hallName: book.hallName,
        volumeNo: book.volumeNo,
        editor: book.editor,
        compilationDate: book.compilationDate,
      },
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
      {/* Sub-header: active family hint + quick create */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-[var(--surface-subtle)]">
        <p className="text-[12px] text-muted-foreground truncate">
          当前家族 ·{' '}
          <span className="font-medium text-foreground">
            {activeProject?.name || '未命名家族'}
          </span>
        </p>
        <button
          type="button"
          onClick={openCreateModal}
          title="新建谱书"
          className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Plus size={14} />
          <span>新建</span>
        </button>
      </div>

      {/* Book List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2.5">
        {books.map((book, idx) => {
          const isActive = book.id === selectedBookId;
          const isFirst = idx === 0;
          const isLast = idx === books.length - 1;
          const metaParts = [
            book.hallName,
            book.compilationDate,
          ].filter(Boolean);

          return (
            <div
              key={book.id}
              onClick={() => selectBook(activeProjectId, book.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectBook(activeProjectId, book.id);
                }
              }}
              className={`group rounded-xl border p-2.5 transition-all cursor-pointer select-none ${
                isActive
                  ? 'border-primary/60 bg-primary/[0.06] dark:bg-primary/15 shadow-xs'
                  : 'border-border bg-card hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <BookCoverThumb
                  bookName={book.bookName}
                  volumeNo={book.volumeNo}
                  bindingStyle={book.layoutConfig.bindingStyle}
                  size="sm"
                />

                <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[70px]">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <h4
                        className={`text-[13px] font-semibold truncate ${
                          isActive ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {book.bookName}
                      </h4>
                    </div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                      {book.volumeNo && (
                        <div className="truncate">{book.volumeNo}</div>
                      )}
                      {metaParts.length > 0 && (
                        <div className="truncate">{metaParts.join(' · ')}</div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div
                    className="flex items-center justify-end gap-0.5 pt-1.5 mt-1 border-t border-border/50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={isFirst}
                      title="上移"
                      onClick={() => {
                        void moveBook(book.id, -1).catch((err) =>
                          toast.error(`调整顺序失败：${errorMessage(err)}`),
                        );
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      title="下移"
                      onClick={() => {
                        void moveBook(book.id, 1).catch((err) =>
                          toast.error(`调整顺序失败：${errorMessage(err)}`),
                        );
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      title="修改"
                      onClick={() => openEditModal(book)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      title="复制"
                      onClick={() => {
                        void duplicateBook(book.id).catch((err) =>
                          toast.error(`复制谱书失败：${errorMessage(err)}`),
                        );
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      onClick={() => setDeleteTarget(book)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Dashed Bottom Create Book Card */}
        <button
          type="button"
          onClick={openCreateModal}
          className="w-full rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.04] p-3 flex items-center justify-center gap-2 text-[12px] font-medium text-muted-foreground hover:text-primary transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>创建谱书</span>
        </button>
      </div>

      <BookMetaModal
        open={modalState.open}
        mode={modalState.mode}
        initialValue={modalState.initialValue}
        onClose={() => setModalState((prev) => ({ ...prev, open: false }))}
        onSubmit={(values) => {
          if (modalState.mode === 'create') {
            void createBook(values).catch((err) =>
              toast.error(`创建谱书失败：${errorMessage(err)}`),
            );
          } else if (modalState.bookId) {
            void updateBookMeta(modalState.bookId, values).catch((err) =>
              toast.error(`修改谱书失败：${errorMessage(err)}`),
            );
          }
          setModalState((prev) => ({ ...prev, open: false }));
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除谱书"
        description={`确定要删除《${deleteTarget?.bookName || ''}》吗？该谱书的目录编排与已生成的谱例快照将被一并移除，但不会影响原世系图与谱文库中的内容。`}
        confirmLabel="确认删除"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void deleteBook(deleteTarget.id).catch((err) =>
              toast.error(`删除谱书失败：${errorMessage(err)}`),
            );
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { RepoDetails } from '../types';
import { X, AlertCircle, Github, Layers, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence, useSpring, useTransform } from 'motion/react';

interface RepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  repo: RepoDetails | null;
  isLoading: boolean;
  onAttachRepo: () => void;
}

export const RepoModal: React.FC<RepoModalProps> = ({ isOpen, onClose, repo, isLoading, onAttachRepo }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Animations handled via Framer Motion components and hooks below
  const starsValue = useSpring(0, { stiffness: 40, damping: 10 });
  const forksValue = useSpring(0, { stiffness: 40, damping: 10 });
  const issuesValue = useSpring(0, { stiffness: 40, damping: 10 });

  useEffect(() => {
    if (isOpen && repo) {
      starsValue.set(repo.stargazers_count);
      forksValue.set(repo.forks_count);
      issuesValue.set(repo.open_issues_count);
    } else {
      starsValue.set(0);
      forksValue.set(0);
      issuesValue.set(0);
    }
  }, [isOpen, repo, starsValue, forksValue, issuesValue]);

  const starsFormatted = useTransform(starsValue, (v: number) => new Intl.NumberFormat('en-US', { notation: "compact" }).format(Math.round(v)));
  const forksFormatted = useTransform(forksValue, (v: number) => new Intl.NumberFormat('en-US', { notation: "compact" }).format(Math.round(v)));
  const issuesFormatted = useTransform(issuesValue, (v: number) => new Intl.NumberFormat('en-US', { notation: "compact" }).format(Math.round(v)));


  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
            className="relative w-full max-w-md bg-white dark:bg-black rounded-3xl border border-gray-100 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-black dark:hover:text-white transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-6 min-h-[400px]">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-gray-100 dark:border-zinc-800 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-lg font-display font-bold tracking-tight">Syncing Repository...</p>
              </div>
            ) : repo ? (
              <div className="p-8">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-white/10 flex items-center justify-center mb-6">
                  <img
                    src={repo.owner.avatar_url}
                    alt={repo.owner.login}
                    className="w-10 h-10 rounded-lg"
                  />
                </div>

                <h2 className="text-2xl font-display font-bold text-black dark:text-white leading-tight mb-2">
                  {repo.name}
                </h2>
                <p className="text-sm text-gray-400 font-medium mb-8">
                  {repo.full_name}
                </p>

                <div className="grid grid-cols-3 gap-3 mb-8">
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-900 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Stars</p>
                    <motion.p className="text-xl font-display font-bold text-black dark:text-white">
                      {starsFormatted}
                    </motion.p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-900 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Forks</p>
                    <motion.p className="text-xl font-display font-bold text-black dark:text-white">
                      {forksFormatted}
                    </motion.p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-900 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Issues</p>
                    <motion.p className="text-xl font-display font-bold text-black dark:text-white">
                      {issuesFormatted}
                    </motion.p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={onAttachRepo}
                    className="w-full py-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:scale-[1.02] transition-transform shadow-xl"
                  >
                    Start Analysis
                  </button>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-gray-50 dark:bg-zinc-900 text-black dark:text-white font-bold text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    View on GitHub <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>

              </div>
            ) : (
              <div className="p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-display font-bold text-black dark:text-white mb-2">Not Found</h3>
                <p className="text-gray-400">
                  We couldn't locate that repository. Please check the permissions or URL.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
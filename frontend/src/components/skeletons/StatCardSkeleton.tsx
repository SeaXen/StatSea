import { Skeleton } from "@/components/skeletons/WidgetSkeleton";

export function StatCardSkeleton() {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-[#0A0B0E] border border-white/5 p-6">
            <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <div className={`p-3 rounded-xl bg-white/5`}>
                    <Skeleton className="h-6 w-6" />
                </div>
            </div>
            <Skeleton className="h-4 w-16" />
        </div>
    );
}

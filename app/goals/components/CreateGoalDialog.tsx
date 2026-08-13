"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input as BaseInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LabeledInputProps = React.ComponentProps<typeof BaseInput> & {
    label?: string;
};

function Input({ label, id, className, ...props }: LabeledInputProps) {
    const fallbackId = React.useId();
    if (!label) {
        return <BaseInput id={id} className={className} {...props} />;
    }

    const safeId = id || `goal-${fallbackId}`;
    return (
        <div className="space-y-2">
            <Label htmlFor={safeId}>{label}</Label>
            <BaseInput id={safeId} className={className} {...props} />
        </div>
    );
}

export type GoalFormData = {
    title: string;
    targetAmount: string;
    targetDate: string;
    priority: string;
    notes: string;
};

type CreateGoalDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    form: GoalFormData;
    setForm: React.Dispatch<React.SetStateAction<GoalFormData>>;
    onSubmit: () => void;
    isPending: boolean;
};

export function CreateGoalDialog({
    isOpen,
    onOpenChange,
    form,
    setForm,
    onSubmit,
    isPending,
}: CreateGoalDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl p-4 sm:max-w-2xl sm:p-8">
                <DialogHeader className="space-y-2">
                    <DialogTitle>Add Goal</DialogTitle>
                    <DialogDescription>
                        Capture the target, timeline, and priority here without taking space from the dashboard.
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-6"
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSubmit();
                    }}
                >
                    <div className="grid gap-3 md:grid-cols-2">
                        <Input
                            label="Title"
                            value={form.title}
                            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Emergency fund"
                        />
                        <Input
                            label="Target amount"
                            type="number"
                            value={form.targetAmount}
                            onChange={(e) => setForm((prev) => ({ ...prev, targetAmount: e.target.value }))}
                            placeholder="250000"
                        />
                        <Input
                            label="Target date"
                            type="date"
                            value={form.targetDate}
                            onChange={(e) => setForm((prev) => ({ ...prev, targetDate: e.target.value }))}
                        />
                        <Input
                            label="Priority"
                            type="number"
                            min={1}
                            max={5}
                            value={form.priority}
                            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                            placeholder="3"
                        />
                        <div className="md:col-span-2">
                            <Input
                                label="Notes"
                                value={form.notes}
                                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="6 months of expenses"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="ghost" className="rounded-lg" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!form.title.trim() || !form.targetAmount || isPending}
                            variant="secondary"
                            className="rounded-lg"
                        >
                            {isPending ? "Saving..." : "Add goal"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

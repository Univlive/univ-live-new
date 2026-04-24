import { FormEvent, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2 } from "lucide-react";

type TemplateOption = {
    id: string;
    label: string;
    group: "admin" | "educator";
};

type CreateCustomTestProps = {
    createOpen: boolean;
    setCreateOpen: (open: boolean) => void;
    handleCreateCustom: (values: Record<string, any>) => Promise<void> | void;
    creating: boolean;
    selectedTemplateId: string;
    setSelectedTemplateId: (value: string) => void;
    templates: TemplateOption[];
};

const CreateCustomTest = ({
    createOpen,
    setCreateOpen,
    handleCreateCustom,
    creating,
    selectedTemplateId,
    setSelectedTemplateId,
    templates,
}: CreateCustomTestProps) => {
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);
    const [templateName, setTemplateName] = useState("");

    const handleTemplateChange = (value: string) => {
        if (value === "create_custom_template") {
            setSelectedTemplateId("none");
            setSaveAsTemplate(true);
            return;
        }

        setSelectedTemplateId(value);
        if (value === "none") {
            setSaveAsTemplate(false);
            setTemplateName("");
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const values = {
            title: String(formData.get("title") || ""),
            description: String(formData.get("description") || ""),
            subject: String(formData.get("subject") || ""),
            level: String(formData.get("level") || "General"),
            durationMinutes: Number(formData.get("duration") || 0),
            saveAsTemplate,
            templateName: templateName.trim(),
        };

        await handleCreateCustom(values);
    };

    const adminTemplates = templates.filter((template) => template.group === "admin");
    const educatorTemplates = templates.filter((template) => template.group === "educator");

    return (
        <Dialog
            open={createOpen}
            onOpenChange={(open) => {
                setCreateOpen(open);
                if (!open) {
                    setSaveAsTemplate(false);
                    setTemplateName("");
                }
            }}
        >
            <DialogTrigger asChild>
                <Button className="gradient-bg text-white shadow-lg">
                    <Plus className="mr-2 h-4 w-4" /> Create Custom Test
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Create New Test</DialogTitle>
                    <DialogDescription>
                        Start from an admin template or one of your saved templates, then create a new test with the same settings.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-2">
                        <Label>Template</Label>
                        <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                            <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Blank test</SelectItem>
                                {adminTemplates.length > 0 ? (
                                    <SelectGroup>
                                        <SelectLabel>Admin templates</SelectLabel>
                                        {adminTemplates.map((template) => (
                                            <SelectItem key={template.id} value={`admin:${template.id}`}>
                                                {template.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ) : null}
                                {educatorTemplates.length > 0 ? <SelectSeparator /> : null}
                                {educatorTemplates.length > 0 ? (
                                    <SelectGroup>
                                        <SelectLabel>Your templates</SelectLabel>
                                        {educatorTemplates.map((template) => (
                                            <SelectItem key={template.id} value={`edu:${template.id}`}>
                                                {template.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ) : null}
                                <SelectSeparator />
                                <SelectItem value="create_custom_template">Create custom template</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input name="title" required placeholder="e.g. Weekly Biology Mock" className="rounded-xl" />
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            name="description"
                            placeholder="Short instructions / overview..."
                            className="rounded-xl min-h-[90px]"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input name="subject" required className="rounded-xl" placeholder="e.g. Maths" />
                        </div>
                        <div className="space-y-2">
                            <Label>Level</Label>
                            <Input name="level" className="rounded-xl" placeholder="e.g. Medium" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Duration (minutes)</Label>
                        <Input name="duration" required type="number" min={1} defaultValue={60} className="rounded-xl" />
                    </div>

                    <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium">Save as custom template</p>
                                <p className="text-xs text-muted-foreground">Store this setup in your educator templates for future test creation.</p>
                            </div>
                            <Switch checked={saveAsTemplate} onCheckedChange={setSaveAsTemplate} />
                        </div>

                        {saveAsTemplate ? (
                            <div className="space-y-2">
                                <Label>Template name</Label>
                                <Input
                                    value={templateName}
                                    onChange={(event) => setTemplateName(event.target.value)}
                                    placeholder="e.g. Weekly Mock Blueprint"
                                    className="rounded-xl"
                                />
                            </div>
                        ) : null}
                    </div>

                    <Button type="submit" className="w-full rounded-xl" disabled={creating}>
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Test"}
                    </Button>

                    <p className="text-xs text-muted-foreground">
                        Note: Educators cannot import from the global question bank. Add questions manually inside the test.
                    </p>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default CreateCustomTest
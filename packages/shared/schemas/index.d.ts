import { z } from 'zod';
export declare const AuthSchema: {
    register: z.ZodObject<{
        username: z.ZodString;
        email: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        username: string;
        email: string;
        password: string;
    }, {
        username: string;
        email: string;
        password: string;
    }>;
    login: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        password: string;
    }, {
        email: string;
        password: string;
    }>;
    forgotPassword: z.ZodObject<{
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
    }, {
        email: string;
    }>;
    resetPassword: z.ZodObject<{
        token: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        token: string;
        password: string;
    }, {
        token: string;
        password: string;
    }>;
};
export declare const NoteSchema: {
    create: z.ZodObject<{
        title: z.ZodString;
        content: z.ZodString;
        folder_id: z.ZodOptional<z.ZodNumber>;
        is_pinned: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        content: string;
        folder_id?: number | undefined;
        is_pinned?: boolean | undefined;
    }, {
        title: string;
        content: string;
        folder_id?: number | undefined;
        is_pinned?: boolean | undefined;
    }>;
    update: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        folder_id: z.ZodOptional<z.ZodNumber>;
        is_pinned: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        title?: string | undefined;
        content?: string | undefined;
        folder_id?: number | undefined;
        is_pinned?: boolean | undefined;
    }, {
        title?: string | undefined;
        content?: string | undefined;
        folder_id?: number | undefined;
        is_pinned?: boolean | undefined;
    }>;
};
export declare const FolderSchema: {
    create: z.ZodObject<{
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
    }, {
        name: string;
    }>;
    update: z.ZodObject<{
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
    }, {
        name: string;
    }>;
};
export declare const ReviewSchema: {
    create: z.ZodObject<{
        date: z.ZodString;
        content: z.ZodString;
        mood: z.ZodOptional<z.ZodNumber>;
        achievements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        improvements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        plans: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        template_id: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        date: string;
        mood?: number | undefined;
        achievements?: string[] | undefined;
        improvements?: string[] | undefined;
        plans?: string[] | undefined;
        template_id?: number | undefined;
    }, {
        content: string;
        date: string;
        mood?: number | undefined;
        achievements?: string[] | undefined;
        improvements?: string[] | undefined;
        plans?: string[] | undefined;
        template_id?: number | undefined;
    }>;
    update: z.ZodObject<{
        date: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        mood: z.ZodOptional<z.ZodNumber>;
        achievements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        improvements: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        plans: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        template_id: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        content?: string | undefined;
        date?: string | undefined;
        mood?: number | undefined;
        achievements?: string[] | undefined;
        improvements?: string[] | undefined;
        plans?: string[] | undefined;
        template_id?: number | undefined;
    }, {
        content?: string | undefined;
        date?: string | undefined;
        mood?: number | undefined;
        achievements?: string[] | undefined;
        improvements?: string[] | undefined;
        plans?: string[] | undefined;
        template_id?: number | undefined;
    }>;
};

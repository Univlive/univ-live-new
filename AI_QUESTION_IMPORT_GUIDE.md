# AI Question Import Feature - Complete Workflow Explanation

## Overview
The AI Question Import feature allows educators to quickly extract MCQ (Multiple Choice Questions) from PDF exam papers by uploading page images. Gemini AI analyzes the images, extracts questions, identifies diagrams, and saves everything organized in Firebase.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    EDUCATOR UPLOADS PDF                      │
│           (via Frontend → File Upload Component)             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND PROCESSING                         │
│  1. Convert PDF to Page Images (pdf-lib)                    │
│  2. Encode each page as Base64                              │
│  3. Send to backend with metadata                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         /api/ai/import-test-questions.ts                     │
│                  (Backend Handler)                           │
│                                                             │
│  Step 1: Validate Image                                    │
│  ├─ Check MIME type (PNG, JPG, WebP)                      │
│  ├─ Validate size (max 15MB)                              │
│  └─ Decode from Base64                                    │
│                                                             │
│  Step 2: Gemini AI Analysis                               │
│  ├─ Send page image to Gemini 3-Flash                    │
│  ├─ Returns structured JSON with questions                │
│  └─ Extract MCQs with correctOption & bounding boxes     │
│                                                             │
│  Step 3: Process Diagrams                                  │
│  ├─ Use bounding box to crop diagram from page            │
│  ├─ Apply padding (5%) to avoid clipping                 │
│  └─ Upload to Firebase Storage via ImageKit               │
│                                                             │
│  Step 4: De-duplicate & Normalize                          │
│  ├─ Remove exact duplicate questions                       │
│  ├─ Normalize empty arrays & null values                   │
│  └─ Build summary (ready/partial/rejected count)          │
│                                                             │
│  Step 5: Stream Response                                   │
│  ├─ Progress: "Processing page..."                        │
│  ├─ Progress: "Extracting MCQs..."                        │
│  ├─ Progress: "Found X questions. Processing diagrams..."  │
│  ├─ Progress: "Finalizing results..."                     │
│  └─ Complete: Return all questions with URLs              │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│            FIREBASE STORAGE & FIRESTORE                      │
│                                                             │
│  Firebase Storage:                                         │
│  ├─ educators/{educatorId}/diagrams/p{page}_q{index}.jpg  │
│  └─ Store cropped question diagrams                        │
│                                                             │
│  Firestore (Frontend saves):                              │
│  ├─ educators/{educatorId}/my_tests/{testId}/questions   │
│  └─ Store full question data with diagram URLs            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│    FRONTEND RECEIVES & DISPLAYS RESULTS                      │
│  - Show extracted questions count                           │
│  - Display status breakdown (ready/partial/rejected)        │
│  - Allow educator to review/edit before saving              │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step Workflow

### **Step 1: Input Validation**
```typescript
Input: {
  imageBase64: "Base64-encoded image",
  imageMimeType: "image/png",
  fileName: "exam_paper.pdf",
  pageNumber: 1,
  testTitle: "JEE Mains 2024",
  subject: "Physics",
  educatorId: "user_uid"
}

Validation:
✓ MIME type must be PNG/JPG/WebP
✓ Image size max 15MB
✓ imageBase64 must not be empty
✓ Can handle various file sizes and formats
```

### **Step 2: Gemini AI Analysis**

**Input to Gemini:**
- Page image (as Base64 embedded in request)
- System instruction (defines extraction rules)
- Explicit prompt: "Extract all MCQs from this exam page"

**Gemini's Task:**
```
For each MCQ question on the page:
1. Extract the question text (preserve math notation like √2, ∫, etc.)
2. Extract all 4 options (A, B, C, D)
3. Identify the correct answer (from answer key if visible)
4. Set status: "ready" (confident) | "partial" (uncertain) | "rejected" (not MCQ)
5. Find any diagram/graph/figure and return bounding box [ymin, xmin, ymax, xmax]
   - Coordinates in 0-1000 scale (Gemini's 1000×1000 grid)
   - [0,0] = top-left corner, [1000,1000] = bottom-right corner
```

**Gemini Response Schema:**
```typescript
{
  items: [
    {
      sourceIndex: 1,                    // Question number (1-based)
      status: "ready",                   // "ready" | "partial" | "rejected"
      question: "The wavelength of light is...",
      options: ["5×10^-7 m", "4×10^-7 m", "3×10^-7 m", "2×10^-7 m"],
      correctOption: 0,                  // Index of correct answer (A=0, B=1, etc)
      reasons: ["Use wavelength formula", "Calculate using frequency"],
      rawBlock: "Q1: The wavelength... (max 80 chars)",
      questionImageBox: [150, 200, 350, 600]  // Bounding box for diagram
    },
    // ... more questions
  ]
}
```

### **Step 3: Diagram Extraction & Upload**

If Gemini found a diagram (non-empty `questionImageBox`):

```typescript
// 1. Convert Gemini's 0-1000 coordinates to actual pixels
Gemini Box: [150, 200, 350, 600]           // normalized 0-1000
Actual Image: 1200×1600 pixels

Conversion:
- ymin_px = (150 / 1000) × 1600 = 240 pixels
- xmin_px = (200 / 1000) × 1200 = 240 pixels  
- ymax_px = (350 / 1000) × 1600 = 560 pixels
- xmax_px = (600 / 1000) × 1200 = 720 pixels

// 2. Apply 5% padding to avoid clipping edges
Padding = (xmax - xmin) * 0.05 = (720 - 240) * 0.05 = 24 pixels
Final crop: [216, 264, 584, 744]

// 3. Crop the image using sharp library
cropped = await sharp(originalImage)
  .extract({
    left: 264,
    top: 216,
    width: 480,
    height: 368
  })
  .toBuffer();

// 4. Upload to Firebase Storage
URL: "https://ik.imagekit.io/univ/educators/user123/diagrams/p1_q1_1234567890.jpg"

// 5. Attach URL to question
question.questionImageUrl = "https://..."
```

### **Step 4: De-duplication**

Remove exact duplicate questions:
```typescript
// Questions are considered duplicates if:
// - Same question text (case-insensitive)
// - Same options in same order (case-insensitive)

Before: 5 questions (with 1 duplicate)
After: 4 unique questions (duplicate removed)

Summary:
{
  total: 4,
  ready: 3,      // Confident extractions
  partial: 1,    // Uncertain (missing correct answer)
  rejected: 0    // Non-MCQ items filtered out
}
```

### **Step 5: Stream Response**

Real-time progress updates to frontend:

```typescript
// Progress events sent via Server-Sent Events (SSE)

Event 1: { type: "progress", message: "Processing page 1 from exam_paper.pdf..." }
Event 2: { type: "progress", message: "Extracting MCQ questions with AI..." }
Event 3: { type: "progress", message: "Found 5 questions. Processing diagrams..." }
Event 4: { type: "progress", message: "Finalizing results..." }
Event 5: {
  type: "complete",
  data: {
    summary: { total: 4, ready: 3, partial: 1, rejected: 0 },
    items: [
      { questionText, options, correctOption, status, questionImageUrl },
      // ... more questions
    ],
    meta: { fileName, pageNumber, diagnostics }
  }
}
```

---

## The 4 Statuses Explained

| Status | Meaning | Example |
|--------|---------|---------|
| **ready** | ✅ Confident extraction with correct answer | "Q1: The wavelength... Answer: B" |
| **partial** | ⚠️ Question extracted but answer uncertain | "Q2: Calculate... [Answer not visible on page]" |
| **rejected** | ❌ Not a valid MCQ | "Instructions:", "Question 3 (not MCQ)", "Page header" |
| **removed** | 🔄 Duplicate of another question | (Cleaned during de-duplication) |

---

## Data Flow: Frontend → Backend → Storage

```
FRONTEND (Educator)
    ↓
    ├─ Select PDF file
    ├─ Convert to images (pdf-lib)
    ├─ Encode as Base64
    └─ Send per-page to API
         ↓
    /api/ai/import-test-questions
         ↓
         ├─ Validate image
         ├─ Send to Gemini AI
         ├─ Receive extraction results
         ├─ Crop & upload diagrams → Firebase Storage
         ├─ De-duplicate questions
         └─ Stream progress & results → Frontend
              ↓
    FRONTEND (receives & displays)
         ↓
         ├─ Show "4 ready, 1 partial, 0 rejected"
         ├─ Display extracted questions
         ├─ Allow edit/review
         └─ Save to Firestore
              ↓
    FIRESTORE
         ├─ educators/{uid}/my_tests/{testId}/questions/{qId}
         └─ Data includes questionImageUrl to diagrams
```

---

## Key Technologies Used

| Technology | Purpose |
|---|---|
| **Gemini 3-Flash AI** | Extract MCQs, identify correct answers, detect diagrams |
| **pdf-lib** (Frontend) | Convert PDF pages to PNG images |
| **sharp** | Crop images using bounding box coordinates |
| **ImageKit** | Upload & serve diagram images |
| **Firebase Storage** | Store cropped diagrams |
| **Firestore** | Store question data |
| **Server-Sent Events (SSE)** | Stream progress to frontend |

---

## Example: Single Question Flow

```
ORIGINAL PDF PAGE:
┌─────────────────────────┐
│ Q1: The wavelength...   │
├─────────────────────────┤
│ A) 5×10^-7 m     ┌──────┤
│ B) 4×10^-7 m     │      │
│ C) 3×10^-7 m     │ WAVE │
│ D) 2×10^-7 m     │ FORM │
│                  └──────┤
│ Answer: B              │
└─────────────────────────┘

↓ GEMINI ANALYZES

GEMINI RESPONSE:
{
  sourceIndex: 1,
  status: "ready",
  question: "The wavelength of light in the electromagnetic spectrum...",
  options: [
    "5×10^-7 m",
    "4×10^-7 m",
    "3×10^-7 m",
    "2×10^-7 m"
  ],
  correctOption: 1,  // B (0-indexed)
  reasons: [
    "Wavelength = c/f",
    "Yellow light range: 4-6 × 10^-7 m"
  ],
  rawBlock: "Q1: The wavelength of light in...",
  questionImageBox: [400, 600, 650, 1000]  // Bounding box for WAVE FORM diagram
}

↓ DIAGRAM EXTRACTION

Extract box [400, 600, 650, 1000] from original image
Apply 5% padding
Upload to Firebase Storage
URL: "https://ik.imagekit.io/univ/.../p1_q1.jpg"

↓ FINAL STORED QUESTION

{
  id: "q123",
  questionText: "The wavelength of light...",
  options: ["5×10^-7 m", "4×10^-7 m", "3×10^-7 m", "2×10^-7 m"],
  correctOptionIndex: 1,
  status: "ready",
  questionImageUrl: "https://ik.imagekit.io/univ/.../p1_q1.jpg",
  waveformDiagram: {
    url: "https://...",
    coordinates: [400, 600, 650, 1000]
  }
}
```

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "GEMINI_API_KEY not configured" | Missing env var | Add key to .env |
| "Image too large" | File > 15MB | Compress or split PDF |
| "Unsupported MIME type" | Format not PNG/JPG | Convert image to allowed format |
| "Gemini returned empty response" | API timeout/issue | Retry, check image quality |
| "No MCQ questions detected" | Blank page or non-exam image | Check page is readable |

---

## Performance Notes

- **Single page processing**: ~3-5 seconds
- **Multi-page PDF**: Process pages sequentially or in parallel
- **Caching**: Not implemented (can add if needed)
- **Rate limiting**: Depends on Gemini API limits (quotas)
- **Diagram extraction**: Overhead is diagram upload time, not extraction

---

## Future Enhancements

1. **Batch Processing**: Upload 10+ pages at once
2. **Caching**: Store Gemini responses for identical pages
3. **OCR Fallback**: If Gemini fails, use traditional OCR
4. **Custom Diagram Cropping**: Manual bounding box adjustment
5. **Question Matching**: Auto-match with existing questions
6. **Answer Validation**: Verify correct answers via answer key upload

---

## Summary

The AI Question Import feature is a **3-step pipeline**:

1. **Pages → Gemini Analysis** → Extract questions + diagrams
2. **Diagram Processing** → Crop using bounding boxes → Upload to storage
3. **De-duplication & Streaming** → Clean results → Send to frontend

All with **real-time progress updates** so educators see exactly what's happening!

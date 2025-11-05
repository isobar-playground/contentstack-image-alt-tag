# Contentstack Image ALT Tag Generator

Tool to generate and update ALT tags for images in Contentstack.

## Prerequisites

- Node.js installed
- npm installed

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the project root with the following variables:
```
CONTENTSTACK_API_KEY=your_api_key
CONTENTSTACK_MANAGEMENT_TOKEN=your_management_token
CONTENTSTACK_HOST=your_host (optional)
OPENAI_API_KEY=your_openai_key
```

## Running the Scripts

Run the scripts in sequential order:

```bash
npm run step1
npm run step2
npm run step3
npm run step4
npm run step5
npm run step6
```

Each step performs a specific operation:
- **step1**: Get languages from Contentstack
- **step2**: Get images from Contentstack
- **step3**: Filter images by fields
- **step4**: Generate ALT tags using OpenAI
- **step5**: Wait for batch processing
- **step6**: Update Contentstack with generated ALT tags


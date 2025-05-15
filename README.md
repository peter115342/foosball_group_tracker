# Foosballek

![Python](https://img.shields.io/badge/Python-3.12-green.svg)
![GCP](https://img.shields.io/badge/GCP-Powered-blue.svg)
![CI/CD](https://img.shields.io/badge/CI%2FCD-passing-success.svg)
![Firestore](https://img.shields.io/badge/Firestore-yellow?logo=firebase)
![Firebase](https://img.shields.io/badge/Firebase-orange?logo=firebase)
![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js)

<p align="center">
<img src="public\images\logo_trans.png" alt="Foosball Group Tracker Logo" width="164">
</p>

## About The Project

This is a web application that allows users to track their foosball matches, create groups, and maintain statistics. Deployed at [foosballek.com](https://foosballek.com).

## ⚠️ Disclaimer

I would like to keep this service free for everyone to use. However, as a student, I may not be able to cover all hosting and maintenance costs in the long run. I'll do my best to keep it running without charges, but this might change in the future.

## Features

- **User Authentication**: Login with Google authentication
- **Group Creation**: Create and manage your foosball groups
- **Group Management**: Invite friends using unique codes and migrate existing stats from guests to them
- **Match Tracking**: Record match results and track performance
- **Statistics**: View statistics about your performance

## Technology Stack

| Category              | Technologies                     |
| --------------------- | -------------------------------- |
| Cloud Platform        | Google Cloud Platform (GCP)      |
| Programming Languages | Python, TypeScript (Next.js)     |
| Data Storage          | Firestore                        |
| Backend               | Cloud Functions                  |
| CI                    | GitHub Actions                   |
| Package Management    | uv, npm                          |
| Code Quality          | Ruff                             |
| Testing               | pytest                           |
| Web Framework         | Next.js, ShadCN UI Components    |
| Hosting               | Firebase App Hosting, Cloudflare |

## Screenshots

### Dashboard:

<img width="931" alt="image" src="https://github.com/user-attachments/assets/1b42f1e5-c65f-478c-a929-916adc2cd5b4" />

### Matches:

<img width="937" alt="image" src="https://github.com/user-attachments/assets/969a2e40-cdb6-4a8b-b16d-04f2a91077ae" />

### Statistics:

<img width="923" alt="image" src="https://github.com/user-attachments/assets/beaee2ec-6573-428a-9e5b-44dbdc5652a7" />

## Deployment

The application is deployed to [foosballek.com](https://foosballek.com) using Firebase App Hosting.

## Continuous Integration

The project uses GitHub Actions for continuous integration, defined in `.github/workflows/ci.yml`. The CI pipeline includes:

1. **Linting**: Python code is linted using Ruff
2. **Backend Testing**: Python Cloud Functions are tested using pytest
3. **Frontend Testing**: TypeScript code is tested using Jest

## Usage Limits

To ensure fair use and stay within budget, the following limits are enforced:

### Groups

- Maximum 20 groups per user
- Group creation rate limited to 1 per minute
- Maximum 30 guests per group

### Matches

- Match creation rate limited to 1 every 10 seconds
- Match queries limited to 100 matches per request

These limits help maintain performance and prevent abuse of the system. Additional validation is performed by our backend Cloud Functions.

## Contributing

Contributions are welcome!

## License

Distributed under the MIT License. See `LICENSE` for more information.

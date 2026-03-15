# CRI4.0

## Prerequisites

- [Docker](https://www.docker.com/) installed and available in your system's `PATH`
- [Node.js v25.3.0](https://nodejs.org/en/download/) installed
- [Docker Compose Plugin](https://docs.docker.com/compose/install/) installed
- [Kathará](https://www.kathara.org/) installed


## Installation Instructions

### Debian/Ubuntu
```Bash
curl -sfL https://raw.githubusercontent.com/CoLorenzo/CRI4.0/refs/heads/webui/setup_debian.sh | bash - 
```

### Generic Linux

1. **Install required kernel modules:**
    ```sh
    modprobe nfnetlink_queue
    ```

2. **Clone the repository:**
    ```sh
    git clone https://github.com/CoLorenzo/CRI4.0
    cd CRI4.0
    ```

3. **Install Node.js dependencies (ensure you are using Node.js v25.3.0):**
    ```sh
    npm install
    ```

4. **Build Docker containers (from the `containers` directory):**
    ```sh
    cd containers
    sudo docker compose --profile collector --profile kathara build
    ```

5. **Start the application (in the `containers` directory):**
    ```sh
    npm start
    ```

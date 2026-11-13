# 로컬 시연 전체(Anvil, API, 웹)를 한 컨테이너에서 실행한다.
# 실행: docker compose up --build
FROM node:22.23.2-bookworm-slim

WORKDIR /app

# 의존성 설치를 소스와 분리해 캐시한다. Foundry와 Circom은 npm 패키지에 들어 있다.
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN npm ci --no-audit --no-fund

COPY . .

# 컨테이너 밖(호스트 브라우저)에서 접속하도록 모든 주소에서 받는다.
ENV FINVERIC_HOST=0.0.0.0
EXPOSE 8545 3001 5173

# 첫 실행에 증명 키를 만들고 원장을 배포한다. 다음 실행은 볼륨의 키와 배포를 재사용한다.
CMD ["npm", "run", "dev"]

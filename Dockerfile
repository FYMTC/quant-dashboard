FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3100

CMD ["npm", "run", "dev", "--", "-p", "3100", "--hostname", "0.0.0.0"]

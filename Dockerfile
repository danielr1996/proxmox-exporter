FROM node:18
WORKDIR /app
COPY . .
RUN npm install
RUN npx tsc
EXPOSE 9876
CMD [ "node", "main.js" ]

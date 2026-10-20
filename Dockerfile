FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
RUN git clone https://github.com/TheNerdCow/CinemaGraphy-next.git .
RUN npm install
EXPOSE 7000
CMD ["npm", "start"]
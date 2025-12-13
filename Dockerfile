# Step 1: Use an official Node.js runtime as a parent image
FROM node:21-alpine3.18

# Step 2: Set the working directory
WORKDIR /app

# Step 3: Copy the package.json and package-lock.json to the working directory
COPY package*.json ./

# Step 4: Install the dependencies
RUN npm install --force

# Step 5: Copy the rest of the application code to the working directory
COPY . .

# Step 6: Build the React application
RUN npm run build

# # Step 7: Install a simple HTTP server to serve the static files
# RUN npm install -g serve

# # Step 8: Expose port 3000
# EXPOSE 5173

# # Step 9: Start the server and serve the build folder
# CMD ["serve", "-s", "build", "-l", "5173"]
EXPOSE 5173

# Step 7: Start the development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
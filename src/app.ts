import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import logger from "morgan";
import http from "http";
import { Server } from "socket.io";
import { ExpressPeerServer } from "peer";
import { errorController } from "./controllers/errorController";
import { userRoutes } from "./routes/userRoutes";
import { appointmentRoutes } from "./routes/appointmentRoutes";
import { scheduleRoutes } from "./routes/scheduleRoutes";
import { medicalRecordRoutes } from "./routes/medicalRoutes";
import { mentalHealthRoutes } from "./routes/mentalHealthRoutes";
import { keepActiveRoutes } from "./routes/keepActiveRoutes";
import { notificationRoutes } from "./routes/notificationRoutes";
import { deviceRoutes } from "./routes/deviceRoutes";
import { statusRoutes } from "./routes/statusRoutes";
import { videoConferencingController } from "./controllers/videoConferencingController";
import { videoConferenceRoutes } from "./routes/VideoConferencingRoutes";
import { chatRoutes } from "./routes/chatRoutes";
import { doctorsPatientsRoutes } from "./routes/doctorsPatientRoute";
import { twoFARoutes } from "./routes/twoFARoutes";
import { sessionDeviceRoutes } from "./routes/sessionDeviceRoutes";
import { rateLimitController } from "./controllers/rateLimitController";

dotenv.config();

const app = express();

let url: string;
if (process.env.NODE_ENV === "production") {
  app.use(cors({ origin: process.env.FRONTEND_URL }));
  // app.use(cors({ origin: "*" }));
  url = process.env.FRONTEND_URL!;
} else {
  app.use(cors());
  url = "http://localhost:5173";
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: url,
    // origin: "*",
    methods: ["GET", "POST"],
  },
  allowEIO3: true,
});

// const peerServer = ExpressPeerServer(server, {
//   path: "/peerjs",
// });

const peerServer = ExpressPeerServer(server);

// app.use("/api/v1/conferencing", peerServer);
app.use("/peerjs", peerServer);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger("dev"));
app.use(rateLimitController);

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/schedules", scheduleRoutes);
app.use("/api/v1/medical-records", medicalRecordRoutes);
app.use("/api/v1/mental-health", mentalHealthRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/devices", deviceRoutes);
app.use("/api/v1/status", statusRoutes);
app.use("/api/v1/conferences", videoConferenceRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/doctors-patient", doctorsPatientsRoutes);
app.use("/api/v1/2fa", twoFARoutes);
app.use("/api/v1/session-devices", sessionDeviceRoutes);

videoConferencingController(io);
app.use(keepActiveRoutes);
app.use(errorController);

app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    status: "fail",
    message: "Route not found!",
  });
});

const PORT = 8000 || process.env.PORT;

server.listen(PORT, () => {
  console.log(`Docease server running on port ${PORT}`);
});

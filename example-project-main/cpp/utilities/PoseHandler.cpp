#include "utilities/PoseHandler.h"
#include "utilities/Logger.h"

PoseHandler::PoseHandler() {
}

frc::Pose2d PoseHandler::GetPose() {
    return _poseEstimator.GetEstimatedPosition();
}

frc::Pose2d PoseHandler::GetSimPose() {
    return _simPoseEstimator.GetEstimatedPosition();
}

void PoseHandler::SetPose(frc::Pose2d pose, wpi::array<frc::SwerveModulePosition, 4U> states) {
    _poseEstimator.ResetPosition(pose.Rotation().Degrees(), states, pose);
    _simPoseEstimator.ResetPosition(pose.Rotation().Degrees(), states, pose);
}

void PoseHandler::Update(frc::Rotation2d angle, wpi::array<frc::SwerveModulePosition, 4U> states) {
    _poseEstimator.Update(angle, states);
    Logger::FieldDisplay::GetInstance().SetRobotPose(_poseEstimator.GetEstimatedPosition());
}

void PoseHandler::UpdateSim(frc::Rotation2d angle, wpi::array<frc::SwerveModulePosition, 4U> states, bool resetHeading, frc::Rotation2d heading) {
    _simPoseEstimator.Update(angle, states);
    if (resetHeading) { _simPoseEstimator.ResetRotation(heading); }
    Logger::FieldDisplay::GetInstance().DisplayPose("Sim pose", _simPoseEstimator.GetEstimatedPosition());
}

void PoseHandler::AddVisionMeasurement(frc::Pose2d pose, units::second_t timeStamp, wpi::array<double,3> dev) {
    _poseEstimator.AddVisionMeasurement(pose, timeStamp, dev);
    Logger::FieldDisplay::GetInstance().SetRobotPose(_poseEstimator.GetEstimatedPosition());
}
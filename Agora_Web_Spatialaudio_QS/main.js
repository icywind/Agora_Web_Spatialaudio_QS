import AgoraRTC from "agora-rtc-sdk-ng";
import { SpatialAudioExtension } from "agora-extension-spatial-audio";
var distance = 0; // Used to define and change the the spatial position
var isMediaPlaying = false;
const processors = new Map();
const spatialAudioExtension = new SpatialAudioExtension({
  assetsPath: "./node_modules/agora-extension-spatial-audio/external/",
});

let options = {
  // Pass your App ID here.
  appId: "",
  // Set the channel name.
  channel: "",
  // Pass your temp token here.
  token: null,
  // Set the user ID.
  uid: 0,
};

let channelParameters = {
  // A variable to hold a local audio track.
  localAudioTrack: null,
  // A variable to hold a local video track.
  localVideoTrack: null,
  // A variable to hold the media file track.
  mediaPlayerTrack: null,
  // A variable to hold a remote audio track.
  remoteAudioTrack: null,
  // A variable to hold a remote video track.
  remoteVideoTrack: null,
  // A variable to hold the remote user id.s
  remoteUid: null,
};

async function setupSpatial() {
  AgoraRTC.registerExtensions([spatialAudioExtension]);
  const mockLocalUserNewPosition = {
    // In a production app, the position can be generated by
    // dragging the local user's avatar in a 3D scene.
    position: [1, 1, 1], // Coordinates in the world coordinate system
    forward: [1, 0, 0], // The unit vector of the front axis
    right: [0, 1, 0], // The unit vector of the right axis
    up: [0, 0, 1], // The unit vector of the vertical axis
  };

  spatialAudioExtension.updateSelfPosition(
    mockLocalUserNewPosition.position,
    mockLocalUserNewPosition.forward,
    mockLocalUserNewPosition.right,
    mockLocalUserNewPosition.up
  );
}

async function startBasicCall() {
  // Create an instance of the Agora Engine

  const agoraEngine = AgoraRTC.createClient({ mode: "rtc", codec: "vp9" });
  // Dynamically create a container in the form of a DIV element to play the remote video track.
  const remotePlayerContainer = document.createElement("div");
  // Dynamically create a container in the form of a DIV element to play the local video track.
  const localPlayerContainer = document.createElement("div");
  // Specify the ID of the DIV container. You can use the uid of the local user.
  localPlayerContainer.id = options.uid;
  // Set the textContent property of the local video container to the local user id.
  localPlayerContainer.textContent = "Local user " + options.uid;
  // Set the local video container size.
  localPlayerContainer.style.width = "640px";
  localPlayerContainer.style.height = "480px";
  localPlayerContainer.style.padding = "15px 5px 5px 5px";
  // Set the remote video container size.
  remotePlayerContainer.style.width = "640px";
  remotePlayerContainer.style.height = "480px";
  remotePlayerContainer.style.padding = "15px 5px 5px 5px";
  // Listen for the "user-published" event to retrieve a AgoraRTCRemoteUser object.
  agoraEngine.on("user-published", async (user, mediaType) => {
    // Subscribe to the remote user when the SDK triggers the "user-published" event.
    await agoraEngine.subscribe(user, mediaType);
    console.log("subscribe success");
    // Subscribe and play the remote video in the container If the remote user publishes a video track.
    if (mediaType == "video") {
      // Retrieve the remote video track.
      channelParameters.remoteVideoTrack = user.videoTrack;
      // Retrieve the remote audio track.
      channelParameters.remoteAudioTrack = user.audioTrack;
      // Save the remote user id for reuse.
      channelParameters.remoteUid = user.uid.toString();
      // Specify the ID of the DIV container. You can use the uid of the remote user.
      remotePlayerContainer.id = user.uid.toString();
      channelParameters.remoteUid = user.uid.toString();
      remotePlayerContainer.textContent = "Remote user " + user.uid.toString();
      // Append the remote container to the page body.
      document.body.append(remotePlayerContainer);
      // Play the remote video track.
      channelParameters.remoteVideoTrack.play(remotePlayerContainer);
    }
    // Subscribe and play the remote audio track If the remote user publishes the audio track only.
    if (mediaType == "audio") {
      // Create a  new SpatialAudioProcessor for the remote user
      const processor = spatialAudioExtension.createProcessor();
      // Add the processor to the Map for future use
      processors.set(user.uid.toString(), processor);

      // Inject the SpatialAudioProcessor into the audio track
      const track = user.audioTrack;
      track.pipe(processor).pipe(track.processorDestination);

      // Play the remote audio track.
      track.play();
      channelParameters.remoteAudioTrack = user.audioTrack;
    }
    // Listen for the "user-unpublished" event.
    agoraEngine.on("user-unpublished", (user) => {
      console.log(user.uid + "has left the channel");
    });
  });
  window.onload = function () {
    // Listen to the Join button click event.
    document.getElementById("join").onclick = async function () {
      // Join a channel.
      await agoraEngine.join(
        options.appId,
        options.channel,
        options.token,
        options.uid
      );
      // Create a local audio track from the audio sampled by a microphone.
      channelParameters.localAudioTrack =
        await AgoraRTC.createMicrophoneAudioTrack();
      // Create a local video track from the video captured by a camera.
      channelParameters.localVideoTrack =
        await AgoraRTC.createCameraVideoTrack();
      // Append the local video container to the page body.
      document.body.append(localPlayerContainer);
      // Publish the local audio and video tracks in the channel.
      await agoraEngine.publish([
        channelParameters.localAudioTrack,
        channelParameters.localVideoTrack,
      ]);
      // Play the local video track.
      channelParameters.localVideoTrack.play(localPlayerContainer);
      console.log("publish success!");
    };
    // Listen to the Leave button click event.
    document.getElementById("leave").onclick = async function () {
      // Destroy the local audio and video tracks.
      channelParameters.localAudioTrack.close();
      channelParameters.localVideoTrack.close();
      // Remove the containers you created for the local video and remote video.
      removeVideoDiv(remotePlayerContainer.id);
      removeVideoDiv(localPlayerContainer.id);
      // Leave the channel
      await agoraEngine.leave();
      console.log("You left the channel");
      // Refresh the page for reuse
      window.location.reload();
    };
  };
}

document.getElementById("decreaseDistance").onclick = async function () {
  distance -= 5;
  updatePosition();
};

document.getElementById("increaseDistance").onclick = async function () { 
  distance += 5;
  updatePosition();
};

function updatePosition(){
  document.getElementById("distanceLabel").textContent = distance;

  if (isMediaPlaying){
      const processor = processors.get("media-player");
      processor.updatePlayerPositionInfo({
      position: [distance, 0, 0],
      forward: [1, 0, 0],
      });
  } else {
      const processor = processors.get(channelParameters.remoteUid);
      processor.updateRemotePosition({
      position: [distance, 0, 0],
      forward: [1, 0, 0],
      });
  }
};

document.getElementById("playAudioFile").onclick =
async function localPlayerStart() {
    if (isMediaPlaying) {
        channelParameters.mediaPlayerTrack.setEnabled(false);
        isMediaPlaying = false;
        document.getElementById("playAudioFile").textContent = "Play audio file";
        return;
    }

    const processor = spatialAudioExtension.createProcessor();
    processors.set("media-player", processor);

    const track = await AgoraRTC.createBufferSourceAudioTrack({
        source: "./resources/GodOfGamblers.mp3",
    });

    // Define the spatial position for the local audio player.
    const mockLocalPlayerNewPosition = {
        position: [0, 0, 0],
        forward: [0, 0, 0],
    };

    // Update the spatial position for the local audio player.
    processor.updatePlayerPositionInfo(mockLocalPlayerNewPosition);

    track.startProcessAudioBuffer({ loop: true });
    track.pipe(processor).pipe(track.processorDestination);
    track.play();

    isMediaPlaying = true;
    document.getElementById("playAudioFile").textContent = "Stop playing audio";
    channelParameters.mediaPlayerTrack = track;
};

startBasicCall();
setupSpatial();

// Remove the video stream from the container.
function removeVideoDiv(elementId) {
  console.log("Removing " + elementId + "Div");
  let Div = document.getElementById(elementId);
  if (Div) {
    Div.remove();
  }
}

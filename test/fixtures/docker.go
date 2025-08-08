package fixtures

import (
	"time"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/mantonx/volumeviz/internal/models"
)

// CreateTestVolume creates a test volume for unit tests
func CreateTestVolume(name string) *volume.Volume {
	return &volume.Volume{
		Name:       name,
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/" + name + "/_data",
		CreatedAt:  time.Now().Format(time.RFC3339),
		Labels:     map[string]string{"test": "true"},
		Options:    map[string]string{},
		Scope:      "local",
		Status: map[string]interface{}{
			"active": "true",
		},
		UsageData: &volume.UsageData{
			RefCount: 1,
			Size:     1024 * 1024, // 1MB
		},
	}
}

// CreateTestContainer creates a test container for unit tests
func CreateTestContainer(id, name string) containertypes.Summary {
	return containertypes.Summary{
		ID:      id,
		Names:   []string{"/" + name},
		Image:   "test:latest",
		ImageID: "sha256:test",
		Command: "test",
		Created: time.Now().Unix(),
		State:   "running",
		Status:  "Up 2 hours",
		Ports:   []containertypes.Port{},
		Labels:  map[string]string{"test": "true"},
		Mounts: []containertypes.MountPoint{
			{
				Type:        mount.TypeVolume,
				Name:        "test-volume",
				Source:      "/var/lib/docker/volumes/test-volume/_data",
				Destination: "/data",
				Driver:      "local",
				Mode:        "",
				RW:          true,
				Propagation: mount.PropagationRPrivate,
			},
		},
	}
}

// CreateTestContainerJSON creates a test container JSON for unit tests
func CreateTestContainerJSON(id, name, volumeName string) containertypes.InspectResponse {
	return containertypes.InspectResponse{
		ContainerJSONBase: &containertypes.ContainerJSONBase{
			ID:      id,
			Created: time.Now().Format(time.RFC3339),
			Path:    "/bin/sh",
			Args:    []string{"-c", "while true; do sleep 1; done"},
			State: &containertypes.State{
				Status:     "running",
				Running:    true,
				Paused:     false,
				Restarting: false,
				OOMKilled:  false,
				Dead:       false,
				Pid:        12345,
				ExitCode:   0,
				Error:      "",
				StartedAt:  time.Now().Add(-2 * time.Hour).Format(time.RFC3339),
			},
			Image:           "test:latest",
			ResolvConfPath:  "/var/lib/docker/containers/" + id + "/resolv.conf",
			HostnamePath:    "/var/lib/docker/containers/" + id + "/hostname",
			HostsPath:       "/var/lib/docker/containers/" + id + "/hosts",
			LogPath:         "/var/lib/docker/containers/" + id + "/" + id + "-json.log",
			Name:            name,
			RestartCount:    0,
			Driver:          "overlay2",
			Platform:        "linux",
			MountLabel:      "",
			ProcessLabel:    "",
			AppArmorProfile: "",
		},
		Mounts: []containertypes.MountPoint{
			{
				Type:        mount.TypeVolume,
				Name:        volumeName,
				Source:      "/var/lib/docker/volumes/" + volumeName + "/_data",
				Destination: "/data",
				Driver:      "local",
				Mode:        "",
				RW:          true,
				Propagation: mount.PropagationRPrivate,
			},
		},
		Config: &containertypes.Config{
			Hostname:     "test-container",
			Domainname:   "",
			User:         "",
			AttachStdin:  false,
			AttachStdout: false,
			AttachStderr: false,
			Tty:          false,
			OpenStdin:    false,
			StdinOnce:    false,
			Env:          []string{"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"},
			Cmd:          []string{"/bin/sh", "-c", "while true; do sleep 1; done"},
			Image:        "test:latest",
			Volumes:      map[string]struct{}{"/data": {}},
			WorkingDir:   "/",
			Entrypoint:   nil,
			OnBuild:      nil,
			Labels:       map[string]string{"test": "true"},
		},
		NetworkSettings: &containertypes.NetworkSettings{
			Networks: map[string]*network.EndpointSettings{
				"bridge": {
					IPAMConfig:          nil,
					Links:               nil,
					Aliases:             nil,
					NetworkID:           "bridge",
					EndpointID:          "test-endpoint",
					Gateway:             "172.17.0.1",
					IPAddress:           "172.17.0.2",
					IPPrefixLen:         16,
					IPv6Gateway:         "",
					GlobalIPv6Address:   "",
					GlobalIPv6PrefixLen: 0,
					MacAddress:          "02:42:ac:11:00:02",
					DriverOpts:          nil,
				},
			},
		},
	}
}

// CreateTestVolumeModel creates a test volume model for unit tests
func CreateTestVolumeModel(name string) models.Volume {
	return models.Volume{
		ID:         name,
		Name:       name,
		Driver:     "local",
		Mountpoint: "/var/lib/docker/volumes/" + name + "/_data",
		CreatedAt:  time.Now(),
		Labels:     map[string]string{"test": "true"},
		Options:    map[string]string{},
		Scope:      "local",
		Status:     map[string]string{"active": "true"},
		UsageData: &models.VolumeUsage{
			RefCount: 1,
			Size:     1024 * 1024, // 1MB
		},
	}
}

// CreateTestVolumeContainer creates a test volume container for unit tests
func CreateTestVolumeContainer(id, name, volumeName string) models.VolumeContainer {
	return models.VolumeContainer{
		ID:          id,
		Name:        name,
		State:       "running",
		Status:      "Up 2 hours",
		MountPath:   "/data",
		MountType:   "volume",
		AccessMode:  "rw",
		Propagation: "rprivate",
	}
}

// SampleDockerVersion returns a sample Docker version for testing
func SampleDockerVersion() types.Version {
	return types.Version{
		Platform: struct {
			Name string
		}{
			Name: "Docker Engine - Community",
		},
		Components: []types.ComponentVersion{
			{
				Name:    "Engine",
				Version: "20.10.0",
				Details: map[string]string{
					"ApiVersion":    "1.41",
					"Arch":          "amd64",
					"BuildTime":     "2021-01-01T00:00:00.000000000+00:00",
					"Experimental":  "false",
					"GitCommit":     "abc123",
					"GoVersion":     "go1.16",
					"KernelVersion": "5.10.0",
					"MinAPIVersion": "1.12",
					"Os":            "linux",
				},
			},
		},
		Version:       "20.10.0",
		APIVersion:    "1.41",
		MinAPIVersion: "1.12",
		GitCommit:     "abc123",
		GoVersion:     "go1.16",
		Os:            "linux",
		Arch:          "amd64",
		KernelVersion: "5.10.0",
		BuildTime:     "2021-01-01T00:00:00.000000000+00:00",
	}
}

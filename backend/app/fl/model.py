"""Small CNN architecture for PneumoniaMNIST classification.

Includes hookable penultimate feature extraction and explicit convolutional reference
for PyTorch Grad-CAM explainability.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class PneumoniaCNN(nn.Module):
    def __init__(
        self,
        in_channels: int = 1,
        num_classes: int = 2,
        conv1_channels: int = 16,
        conv2_channels: int = 32,
        resolution: int = 28,
    ):
        super().__init__()
        self.resolution = resolution
        self.num_classes = num_classes

        if resolution == 128:
            # 3 conv blocks for 128x128 resolution
            self.conv1 = nn.Conv2d(in_channels, 32, kernel_size=3, padding=1)
            self.relu1 = nn.ReLU()
            self.pool1 = nn.MaxPool2d(2, 2)

            self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
            self.relu2 = nn.ReLU()
            self.pool2 = nn.MaxPool2d(2, 2)

            # Extra Conv(64, 128, 3, pad1)-ReLU-MaxPool block for size 128. No BatchNorm.
            self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
            self.relu3 = nn.ReLU()
            self.pool3 = nn.MaxPool2d(2, 2)

            self.adaptive_pool = nn.AdaptiveAvgPool2d((7, 7))
            self.flatten = nn.Flatten()
            self.fc1 = nn.Linear(128 * 7 * 7, 64)
            self.relu_fc = nn.ReLU()
            self.dropout = nn.Dropout(0.2)
            self.fc2 = nn.Linear(64, num_classes)
        else:
            # Sizes 28 and 64 use the current two conv blocks
            self.conv1_channels = conv1_channels
            self.conv2_channels = conv2_channels

            self.conv1 = nn.Conv2d(in_channels, conv1_channels, kernel_size=3, padding=1)
            self.relu1 = nn.ReLU()
            self.pool1 = nn.MaxPool2d(2, 2)

            self.conv2 = nn.Conv2d(conv1_channels, conv2_channels, kernel_size=3, padding=1)
            self.relu2 = nn.ReLU()
            self.pool2 = nn.MaxPool2d(2, 2)

            self.adaptive_pool = nn.AdaptiveAvgPool2d((7, 7))
            self.flatten = nn.Flatten()
            self.fc1 = nn.Linear(conv2_channels * 7 * 7, 64)
            self.relu_fc = nn.ReLU()
            self.dropout = nn.Dropout(0.2)
            self.fc2 = nn.Linear(64, num_classes)

    def extract_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extracts penultimate 64-dim representation."""
        x = self.pool1(self.relu1(self.conv1(x)))
        x = self.pool2(self.relu2(self.conv2(x)))
        if self.resolution == 128:
            x = self.pool3(self.relu3(self.conv3(x)))
        x = self.adaptive_pool(x)
        x = self.flatten(x)
        feat = self.relu_fc(self.fc1(x))
        return feat

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.extract_features(x)
        out = self.fc2(self.dropout(feat))
        return out

    def get_last_conv_layer(self) -> nn.Module:
        """Returns the last convolutional layer used by Grad-CAM."""
        return self.conv3 if self.resolution == 128 else self.conv2


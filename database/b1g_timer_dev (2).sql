-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 27, 2026 at 01:37 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `b1g_timer_dev`
--

-- --------------------------------------------------------

--
-- Table structure for table `bible_presets`
--

CREATE TABLE `bible_presets` (
  `id` int(11) NOT NULL,
  `room_id` int(11) NOT NULL,
  `label` varchar(200) NOT NULL,
  `book` varchar(50) NOT NULL,
  `chapter` int(11) NOT NULL,
  `verse_start` int(11) NOT NULL,
  `verse_end` int(11) DEFAULT NULL,
  `version` varchar(10) NOT NULL DEFAULT 'ESV',
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bible_presets`
--

INSERT INTO `bible_presets` (`id`, `room_id`, `label`, `book`, `chapter`, `verse_start`, `verse_end`, `version`, `position`, `created_at`) VALUES
(2, 1, 'John 3:10 (ESV)', 'John', 3, 10, NULL, 'ESV', 0, '2026-03-26 15:07:30'),
(3, 17, 'Genesis 1:2 (TL)', 'Genesis', 1, 2, NULL, 'TL', 0, '2026-03-26 16:20:46');

-- --------------------------------------------------------

--
-- Table structure for table `timer_items`
--

CREATE TABLE `timer_items` (
  `id` int(11) NOT NULL,
  `room_id` int(11) NOT NULL,
  `title` varchar(100) NOT NULL,
  `duration_seconds` int(11) NOT NULL,
  `position` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `timer_items`
--

INSERT INTO `timer_items` (`id`, `room_id`, `title`, `duration_seconds`, `position`, `created_at`, `updated_at`) VALUES
(210, 17, 'Timer 1', 600, 0, '2026-03-25 22:28:58', '2026-03-26 13:10:00'),
(211, 17, 'Timer 2', 600, 1, '2026-03-25 22:28:58', '2026-03-26 13:10:00'),
(212, 17, 'Timer 3', 600, 2, '2026-03-25 22:28:58', '2026-03-26 13:10:00'),
(213, 18, 'Timer 1', 600, 0, '2026-03-25 22:29:32', '2026-03-26 14:12:51'),
(214, 18, 'Timer 2', 600, 1, '2026-03-25 22:29:32', '2026-03-26 14:12:51'),
(215, 18, 'Timer 3', 600, 2, '2026-03-25 22:29:32', '2026-03-26 14:12:51'),
(216, 18, 'Timer 4', 600, 3, '2026-03-25 22:29:32', '2026-03-26 14:12:51'),
(217, 17, 'Timer 4', 600, 3, '2026-03-25 22:29:39', '2026-03-26 13:10:00'),
(218, 18, 'Timer 5', 600, 4, '2026-03-26 11:02:24', '2026-03-26 14:12:51'),
(219, 18, 'Timer 6', 600, 5, '2026-03-26 11:10:32', '2026-03-26 14:12:51'),
(220, 18, 'Timer 7', 600, 6, '2026-03-26 11:11:27', '2026-03-26 14:12:51'),
(221, 18, 'Timer 8', 600, 7, '2026-03-26 13:01:51', '2026-03-26 14:12:51'),
(222, 18, 'Timer 9', 600, 8, '2026-03-26 13:03:31', '2026-03-26 14:12:51');

-- --------------------------------------------------------

--
-- Table structure for table `timer_live_state`
--

CREATE TABLE `timer_live_state` (
  `room_id` int(11) NOT NULL,
  `is_running` tinyint(1) NOT NULL DEFAULT 0,
  `deadline_timestamp` bigint(20) DEFAULT NULL,
  `remaining_seconds` int(11) DEFAULT NULL,
  `timer_index` smallint(6) DEFAULT NULL,
  `timer_title` varchar(100) DEFAULT NULL,
  `action` varchar(30) DEFAULT NULL,
  `state_json` text NOT NULL,
  `stage_style_json` text DEFAULT NULL,
  `message_json` text DEFAULT NULL,
  `bible_json` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `timer_live_state`
--

INSERT INTO `timer_live_state` (`room_id`, `is_running`, `deadline_timestamp`, `remaining_seconds`, `timer_index`, `timer_title`, `action`, `state_json`, `stage_style_json`, `message_json`, `bible_json`, `updated_at`) VALUES
(2, 0, NULL, 600, 0, 'Timer 1', 'TIMER_RESET', '{\"action\":\"TIMER_RESET\",\"isRunning\":false,\"remainingSeconds\":600,\"deadlineTimestamp\":null,\"timerIndex\":0,\"timerTitle\":\"Timer 1\",\"savedAt\":\"2026-03-26T06:00:48+08:00\",\"serverTime\":1774476048}', '{\"timerColor\":\"#ffffff\",\"clockColor\":\"#808080\",\"timerFont\":\"\'Courier New\', monospace\",\"timerFontSize\":22,\"clockFont\":\"\'Courier New\', monospace\",\"clockFontSize\":6,\"bgColor\":\"#000000\"}', '{\"text\":\"dasdfaswefawe\",\"color\":\"green\",\"bold\":true,\"fontSize\":\"normal\",\"fontStyle\":\"monospace\",\"scrollEnabled\":false,\"scrollDirection\":\"left\",\"scrollSpeed\":3,\"msgBgType\":\"transparent\",\"msgBgColor\":\"#000000\",\"displayId\":\"stage-lrfg36tj0\"}', NULL, '2026-03-25 22:00:48'),
(5, 0, NULL, NULL, 7, NULL, 'TIMER_STOP', '{\"action\":\"TIMER_STOP\",\"isRunning\":false,\"remainingSeconds\":null,\"deadlineTimestamp\":null,\"timerIndex\":7,\"timerTitle\":null,\"savedAt\":\"2026-03-26T05:22:58+08:00\",\"serverTime\":1774473778}', '{\"timerColor\":\"#ffffff\",\"clockColor\":\"#808080\",\"timerFont\":\"\'Courier New\', monospace\",\"timerFontSize\":22,\"clockFont\":\"\'Courier New\', monospace\",\"clockFontSize\":6,\"bgColor\":\"#000000\"}', '{\"text\":\"RELOAD-TEST-1774475830590\",\"color\":\"white\",\"bold\":false,\"fontSize\":\"normal\",\"fontStyle\":\"sans-serif\",\"scrollEnabled\":false,\"scrollDirection\":\"left\",\"scrollSpeed\":10,\"msgBgType\":\"default\",\"msgBgColor\":\"#000000\",\"displayId\":\"unknown\"}', NULL, '2026-03-25 21:57:11'),
(6, 0, NULL, 1199, 0, NULL, 'TIMER_PAUSE', '{\"action\":\"TIMER_PAUSE\",\"isRunning\":false,\"remainingSeconds\":1198.7560000419617,\"deadlineTimestamp\":null,\"timerIndex\":0,\"timerTitle\":null,\"savedAt\":\"2026-03-26T04:32:04+08:00\",\"serverTime\":1774470724}', NULL, NULL, NULL, '2026-03-25 20:32:04'),
(7, 0, NULL, 598, 1, NULL, 'TIMER_PAUSE', '{\"action\":\"TIMER_PAUSE\",\"isRunning\":false,\"remainingSeconds\":597.9389998912811,\"deadlineTimestamp\":null,\"timerIndex\":1,\"timerTitle\":null,\"savedAt\":\"2026-03-26T02:59:01+08:00\",\"serverTime\":1774465141}', NULL, NULL, NULL, '2026-03-25 18:59:01'),
(16, 1, 1774478221, 600, 1, 'Timer 2', 'TIMER_START', '{\"action\":\"TIMER_START\",\"isRunning\":true,\"remainingSeconds\":600,\"deadlineTimestamp\":1774478221,\"timerIndex\":1,\"timerTitle\":\"Timer 2\",\"savedAt\":\"2026-03-26T06:27:01+08:00\",\"serverTime\":1774477621}', NULL, NULL, NULL, '2026-03-25 22:27:21'),
(17, 0, NULL, NULL, 0, NULL, 'TIMER_STOP', '{\"action\":\"TIMER_STOP\",\"isRunning\":false,\"remainingSeconds\":null,\"deadlineTimestamp\":null,\"timerIndex\":0,\"timerTitle\":null,\"savedAt\":\"2026-03-26T06:29:48+08:00\",\"serverTime\":1774477788}', NULL, NULL, '{\"book\":\"Genesis\",\"chapter\":7,\"verse\":\"15\",\"verseEnd\":null,\"text\":\"At nagsidating kay Noe sa sasakyan na dalawa\'t dalawa, ang lahat ng hayop na may hinga ng buhay.\",\"version\":\"TL\",\"style\":{\"preset\":\"cream\",\"fontFamily\":\"\'Palatino Linotype\', \'Book Antiqua\', serif\",\"fontSize\":\"4.5vw\",\"refFontSize\":\"2vw\",\"textColor\":\"#fff8e1\",\"bgType\":\"solid\",\"bgColor\":\"#2c1a0e\",\"textAlign\":\"center\",\"refPosition\":\"bottom-center\",\"bgImage\":null,\"transition\":\"scale-fade\"},\"displayId\":\"stage-lrfg36tj0\"}', '2026-03-26 23:10:56'),
(18, 0, NULL, 600, 0, 'Timer 1', 'TIMER_RESET', '{\"action\":\"TIMER_RESET\",\"isRunning\":false,\"remainingSeconds\":600,\"deadlineTimestamp\":null,\"timerIndex\":0,\"timerTitle\":\"Timer 1\",\"savedAt\":\"2026-03-26T22:12:45+08:00\",\"serverTime\":1774534365}', NULL, NULL, '{\"book\":\"Revelation\",\"chapter\":21,\"verse\":\"2\",\"verseEnd\":null,\"text\":\"And I saw the holy city, new Jerusalem, coming down out of heaven from God, prepared as a bride adorned for her husband.\",\"version\":\"ESV\",\"style\":{\"preset\":\"modern\",\"fontFamily\":\"\'Segoe UI\', -apple-system, sans-serif\",\"fontSize\":\"4.5vw\",\"refFontSize\":\"2vw\",\"textColor\":\"#e0e0e0\",\"bgType\":\"gradient\",\"bgColor\":\"linear-gradient(135deg, #1a1a2e, #16213e)\",\"textAlign\":\"center\",\"refPosition\":\"bottom-center\",\"bgImage\":null},\"displayId\":\"stage-lrfg36tj0\"}', '2026-03-26 15:12:23');

-- --------------------------------------------------------

--
-- Table structure for table `timer_rooms`
--

CREATE TABLE `timer_rooms` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `dashboard_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `timer_rooms`
--

INSERT INTO `timer_rooms` (`id`, `name`, `dashboard_name`, `created_at`, `updated_at`) VALUES
(17, 'B1G', 'B1G', '2026-03-25 22:28:10', '2026-03-26 13:10:00'),
(18, 'ELEVATE', 'ELEVATE', '2026-03-25 22:29:19', '2026-03-26 14:12:51');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bible_presets`
--
ALTER TABLE `bible_presets`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `timer_items`
--
ALTER TABLE `timer_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_room_id_position` (`room_id`,`position`),
  ADD KEY `idx_room_id` (`room_id`);

--
-- Indexes for table `timer_live_state`
--
ALTER TABLE `timer_live_state`
  ADD PRIMARY KEY (`room_id`);

--
-- Indexes for table `timer_rooms`
--
ALTER TABLE `timer_rooms`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bible_presets`
--
ALTER TABLE `bible_presets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `timer_items`
--
ALTER TABLE `timer_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=223;

--
-- AUTO_INCREMENT for table `timer_rooms`
--
ALTER TABLE `timer_rooms`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `timer_items`
--
ALTER TABLE `timer_items`
  ADD CONSTRAINT `fk_timer_items_room_id` FOREIGN KEY (`room_id`) REFERENCES `timer_rooms` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

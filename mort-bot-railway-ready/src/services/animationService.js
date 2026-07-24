const { themedEmbed, progressBar } = require('../utils/theme');
const { COLORS, THEME } = require('../config/blueprint');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function animatedReply(interaction, title, steps, finalDescription) {
  const total = steps.length;
  await interaction.deferReply({ ephemeral: true });

  for (let index = 0; index < steps.length; index += 1) {
    const step = index + 1;
    const embed = themedEmbed({
      title: `${THEME.icons.spark} ${title}`,
      description: `${progressBar(step, total)}\n\n${steps[index]}`,
      color: index % 2 === 0 ? COLORS.royalPurple : COLORS.lightBlue
    });
    await interaction.editReply({ embeds: [embed] });
    await sleep(650);
  }

  const embed = themedEmbed({
    title: `${THEME.icons.success} ${title} Complete`,
    description: finalDescription,
    color: COLORS.success
  });
  await interaction.editReply({ embeds: [embed] });
}

async function editMessageAnimation(message, frames, delay = 700) {
  for (const frame of frames) {
    await message.edit(frame).catch(() => null);
    await sleep(delay);
  }
}

function introFrames() {
  return [
    themedEmbed({
      title: '✦ Mort initializing...',
      description: '▰▱▱▱▱▱▱▱▱▱▱▱\nLoading black/purple/light-blue core.',
      color: COLORS.royalPurple
    }),
    themedEmbed({
      title: '✦ Mort syncing server systems...',
      description: '▰▰▰▰▱▱▱▱▱▱▱▱\nRoles, categories, panels, support, and voice rooms are online.',
      color: COLORS.lightBlue
    }),
    themedEmbed({
      title: '✦ Mort is awake.',
      description: '▰▰▰▰▰▰▰▰▰▰▰▰\nThe server is under Mort protection.',
      color: COLORS.royalPurple
    })
  ];
}

module.exports = {
  animatedReply,
  editMessageAnimation,
  introFrames,
  sleep
};
